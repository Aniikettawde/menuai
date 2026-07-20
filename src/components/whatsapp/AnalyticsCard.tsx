// src/components/whatsapp/AnalyticsCard.tsx
'use client'

import { useEffect, useState } from 'react'
import { BarChart3, Wallet } from 'lucide-react'

const BRAND = {
  ivory: '#FBF6EC', card: '#FFFFFF', line: '#E7DDC9',
  ink: '#2B211F', inkSoft: '#6E5F57', inkFaint: '#9C8F86',
  burgundy: '#7A2333', emerald: '#2F7A5C', rose: '#B23B4A',
}

const cardBase = 'rounded-2xl border shadow-[0_1px_2px_rgba(43,33,31,0.04)]'

type Analytics = {
  totals: { sent: number; delivered: number; read: number; failed: number; spend: number; deliveryRate: number; readRate: number }
  daily: { date: string; count: number }[]
  creditBalance: number
  recentCampaigns: { name: string; sent_count: number; delivered_count: number; read_count: number; failed_count: number; actual_cost: number }[]
}

function StatBox({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="rounded-xl border p-3" style={{ borderColor: BRAND.line, background: BRAND.ivory }}>
      <p className="text-[10px]" style={{ color: BRAND.inkFaint }}>{label}</p>
      <p className="mt-0.5 text-lg font-bold" style={{ color: color || BRAND.ink }}>{value}</p>
    </div>
  )
}

export default function AnalyticsCard({ restaurantId }: { restaurantId: string }) {
  const [data, setData] = useState<Analytics | null>(null)

  useEffect(() => {
    fetch(`/api/restaurant/whatsapp/analytics?restaurantId=${restaurantId}`)
      .then((r) => r.json())
      .then(setData)
  }, [restaurantId])

  if (!data) return null

  const maxDaily = Math.max(...data.daily.map((d) => d.count), 1)

  return (
    <div className={`${cardBase} p-5 sm:p-6`} style={{ borderColor: BRAND.line, background: BRAND.card }}>
      <div className="mb-4 flex items-center gap-2.5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ background: `${BRAND.burgundy}14` }}>
          <BarChart3 size={14} style={{ color: BRAND.burgundy }} />
        </div>
        <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: BRAND.inkSoft }}>
          Analytics (last 30 days)
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 mb-4">
        <StatBox label="Messages sent" value={String(data.totals.sent)} />
        <StatBox label="Delivery rate" value={`${data.totals.deliveryRate.toFixed(0)}%`} color={BRAND.emerald} />
        <StatBox label="Read rate" value={`${data.totals.readRate.toFixed(0)}%`} />
        <StatBox label="Total spend" value={`₹${data.totals.spend.toFixed(2)}`} />
      </div>

      <div className="mb-4 flex items-center gap-2 rounded-xl border p-3" style={{ borderColor: BRAND.line, background: BRAND.ivory }}>
        <Wallet size={16} style={{ color: BRAND.burgundy }} />
        <span className="text-xs" style={{ color: BRAND.inkSoft }}>Current wallet balance:</span>
        <span className="text-sm font-bold" style={{ color: BRAND.ink }}>₹{data.creditBalance.toFixed(2)}</span>
      </div>

      {data.daily.length > 0 && (
        <div className="mb-4">
          <p className="text-[10px] mb-2" style={{ color: BRAND.inkFaint }}>Daily volume</p>
          <div className="flex items-end gap-1 h-24">
            {data.daily.map((d) => (
              <div key={d.date} className="flex-1 rounded-t" style={{ height: `${(d.count / maxDaily) * 100}%`, background: BRAND.burgundy, minHeight: 2 }} title={`${d.date}: ${d.count}`} />
            ))}
          </div>
        </div>
      )}

      {data.recentCampaigns.length > 0 && (
        <div>
          <p className="text-[10px] mb-2" style={{ color: BRAND.inkFaint }}>Recent campaigns</p>
          <div className="space-y-1.5">
            {data.recentCampaigns.map((c, i) => (
              <div key={i} className="flex items-center justify-between text-[11px] rounded-lg border px-3 py-2" style={{ borderColor: BRAND.line }}>
                <span className="truncate" style={{ color: BRAND.ink }}>{c.name}</span>
                <span style={{ color: BRAND.inkSoft }}>{c.sent_count} sent · {c.delivered_count} delivered · ₹{c.actual_cost.toFixed(2)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}