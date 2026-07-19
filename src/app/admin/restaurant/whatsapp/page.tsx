// src/app/admin/restaurant/whatsapp/page.tsx
'use client'

import { useEffect, useState } from 'react'
import RestaurantWhatsAppInbox from '@/components/whatsapp/RestaurantWhatsAppInbox'

const BRAND = {
  ivory: '#FBF6EC',
  card: '#FFFFFF',
  line: '#E7DDC9',
  ink: '#2B211F',
  inkSoft: '#6E5F57',
  inkFaint: '#9C8F86',
  burgundy: '#7A2333',
}

type RestaurantOption = {
  restaurant_id: string
  business_name: string | null
  display_phone_number: string | null
}

export default function AdminRestaurantWhatsAppPage() {
  const [restaurants, setRestaurants] = useState<RestaurantOption[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedRestaurantId, setSelectedRestaurantId] = useState('')

  useEffect(() => {
    fetch('/api/admin/whatsapp/restaurants')
      .then((r) => r.json())
      .then((data) => {
        const list: RestaurantOption[] = data?.restaurants ?? []
        setRestaurants(list)
        if (list.length > 0) setSelectedRestaurantId(list[0].restaurant_id)
      })
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="min-h-screen p-4 sm:p-6" style={{ background: BRAND.ivory }}>
      <div className="mx-auto max-w-5xl space-y-4">
        <div className="rounded-2xl border p-4 sm:p-5" style={{ borderColor: BRAND.line, background: BRAND.card }}>
          <h1 className="text-lg font-bold" style={{ color: BRAND.ink }}>
            Restaurant WhatsApp Inbox
          </h1>
          <p className="mt-1 text-xs" style={{ color: BRAND.inkSoft }}>
            View and reply to a connected restaurant's WhatsApp conversations.
          </p>

          <div className="mt-4">
            <label className="mb-1 block text-[10px] font-medium uppercase tracking-wider" style={{ color: BRAND.inkFaint }}>
              Restaurant
            </label>
            {loading ? (
              <p className="text-xs" style={{ color: BRAND.inkFaint }}>Loading restaurants…</p>
            ) : restaurants.length === 0 ? (
              <p className="text-xs" style={{ color: BRAND.inkFaint }}>No connected restaurants found.</p>
            ) : (
              <select
                value={selectedRestaurantId}
                onChange={(e) => setSelectedRestaurantId(e.target.value)}
                className="w-full max-w-md rounded-lg border px-3 py-2 text-sm outline-none sm:w-auto"
                style={{ borderColor: BRAND.line, background: BRAND.ivory, color: BRAND.ink }}
              >
                {restaurants.map((r) => (
                  <option key={r.restaurant_id} value={r.restaurant_id}>
                    {r.business_name || 'Unnamed restaurant'}
                    {r.display_phone_number ? ` — ${r.display_phone_number}` : ''}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>

        {selectedRestaurantId && <RestaurantWhatsAppInbox restaurantId={selectedRestaurantId} />}
      </div>
    </div>
  )
}