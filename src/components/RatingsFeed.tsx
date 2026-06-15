'use client'

import { useEffect, useState } from 'react'
import { Star } from 'lucide-react'
import { getSupabaseBrowser } from '@/lib/supabase'
import type { Rating } from '@/types'

function Stars({ score }: { score: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          size={14}
          className={i < score ? 'fill-amber-400 text-amber-400' : 'text-slate-300'}
        />
      ))}
    </div>
  )
}

export function RatingsFeed({ restaurantId }: { restaurantId: string }) {
  const [ratings, setRatings] = useState<Rating[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const supabase = getSupabaseBrowser()

    async function loadRatings() {
      setLoading(true)
      const { data, error } = await supabase
        .from('ratings')
        .select('id, restaurant_id, session_id, order_id, order_code, table_number, score, comment, is_public, created_at')
        .eq('restaurant_id', restaurantId)
        .eq('is_public', true)
        .order('created_at', { ascending: false })
        .limit(6)

      if (!error && data) {
        setRatings(data as Rating[])
      }

      setLoading(false)
    }

    void loadRatings()

    const channel = supabase
      .channel(`ratings-${restaurantId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'ratings', filter: `restaurant_id=eq.${restaurantId}` },
        () => {
          void loadRatings()
        },
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [restaurantId])

  return (
    <section className="mt-10 rounded-[28px] border border-white/10 bg-white/5 p-5 shadow-2xl backdrop-blur-xl">
      <div className="mb-4 flex items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/40">Guest feedback</p>
          <h3 className="mt-1 text-xl font-black text-white">What diners are saying</h3>
        </div>
        <p className="text-xs text-white/35">Public reviews</p>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((n) => (
            <div key={n} className="h-24 animate-pulse rounded-2xl bg-white/5" />
          ))}
        </div>
      ) : ratings.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/10 bg-white/5 p-6 text-center text-sm text-white/55">
          No ratings yet. Be the first guest to rate this restaurant.
        </div>
      ) : (
        <div className="space-y-3">
          {ratings.map((r) => (
            <div key={r.id} className="rounded-2xl border border-white/10 bg-[#07111f] p-4">
              <div className="flex items-center justify-between gap-3">
                <Stars score={r.score} />
               <span className="text-[11px] text-white/35">
  Table {r.table_number ?? '—'} · {r.order_code ?? (r.order_id ? r.order_id.slice(0, 8) : 'Verified Review')}
</span>
              </div>

              {r.comment ? (
                <p className="mt-3 text-sm leading-relaxed text-white/75">
                  “{r.comment}”
                </p>
              ) : (
                <p className="mt-3 text-sm text-white/45">No comment added.</p>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  )
}