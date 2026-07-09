'use client'

/**
 * CravingBox — "What are you craving?"
 * ─────────────────────────────────────────────────────────────────────────
 * HONEST SCOPE NOTE: there is no `/api/discovery/craving` endpoint yet.
 * Building that requires a product decision this file can't make alone:
 * embedding-based semantic search over menu items/descriptions (pgvector
 * on Supabase is the natural fit given the existing stack) versus a
 * cheaper keyword-expansion approach (map "something spicy and cheap" →
 * tags like ["spicy", "budget"] via a small LLM call, then reuse the
 * existing filter/search query). Recommend the keyword-expansion version
 * first — it's shippable in days against the current schema, whereas
 * pgvector needs a menu-item embedding pipeline first.
 *
 * This component is real and usable today: it degrades to the normal
 * search box behavior (calls onFallbackSearch with the raw text) if the
 * craving endpoint 404s or errors, so shipping the UI now doesn't block on
 * the backend decision above — flip `endpointReady` once the route exists.
 *
 * 1. Customer benefit: lets an undecided customer describe intent in their
 *    own words instead of reverse-engineering which chip/filter matches
 *    "I want something warm and comforting."
 * 2. Cognitive load: replaces a decision tree (cuisine? price? mood?) with
 *    one open text field — for the customer who doesn't know what they
 *    want, one input beats twelve filters.
 * 3. Taps: one tap to open, one to submit — same cost as a normal search,
 *    higher signal quality.
 * 4. Conversion impact: this is the "I don't know what I want" segment,
 *    which today either bounces or scrolls aimlessly. Any resolution to a
 *    concrete result set is a conversion previously left on the table.
 */

import { useState } from 'react'
import { Sparkles, Loader2 } from 'lucide-react'

interface Props {
  onFallbackSearch: (text: string) => void
  endpointReady?: boolean // flip true once /api/discovery/craving exists
}

export function CravingBox({ onFallbackSearch, endpointReady = false }: Props) {
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async () => {
    const trimmed = text.trim()
    if (!trimmed) return

    if (!endpointReady) {
      onFallbackSearch(trimmed)
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/discovery/craving', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: trimmed }),
      })
      if (!res.ok) throw new Error('craving endpoint unavailable')
      const { searchTerms } = (await res.json()) as { searchTerms: string }
      onFallbackSearch(searchTerms || trimmed)
    } catch {
      onFallbackSearch(trimmed) // never leave the customer stuck — degrade to plain search
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="px-3 py-3 sm:px-6">
      <div
        className="flex items-center gap-2.5 rounded-2xl px-3.5 py-3"
        style={{ background: 'rgba(255,122,0,0.05)', border: '1px solid rgba(255,122,0,0.16)' }}
      >
        <Sparkles size={16} style={{ color: 'var(--accent)' }} className="shrink-0" />
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') void handleSubmit() }}
          placeholder="What are you craving? e.g. something spicy and cheap nearby"
          aria-label="Describe what you're craving"
          className="min-w-0 flex-1 bg-transparent text-[13.5px] outline-none"
          style={{ color: 'var(--text)' }}
        />
        <button
          type="button"
          onClick={() => void handleSubmit()}
          disabled={loading || !text.trim()}
          aria-label="Find restaurants matching this craving"
          className="flex shrink-0 items-center justify-center rounded-full font-bold"
          style={{
            width: 40, height: 40,
            background: 'var(--accent)', color: '#fff',
            opacity: loading || !text.trim() ? 0.5 : 1,
          }}
        >
          {loading ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />}
        </button>
      </div>
    </section>
  )
}