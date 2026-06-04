'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle, Sparkles } from 'lucide-react'

export default function PaymentSuccessPage() {
  const router = useRouter()

  useEffect(() => {
    const t = setTimeout(() => router.push('/dashboard'), 3000)
    return () => clearTimeout(t)
  }, [router])

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center px-4">
      <div className="text-center space-y-5 max-w-sm">
        <div className="flex justify-center">
          <div className="relative">
            <div className="w-20 h-20 rounded-full bg-green-500/15 flex items-center justify-center">
              <CheckCircle size={40} className="text-green-400" />
            </div>
            <div className="absolute inset-0 rounded-full border-2 border-green-500/30 animate-ping" />
          </div>
        </div>

        <div>
          <h1 className="text-2xl font-bold text-white mb-2">Payment successful 🎉</h1>
          <p className="text-sm text-zinc-400">
            Your Dinezy subscription is now active.
          </p>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 text-left space-y-2.5">
          {[
            'Plan activated on your account',
            'Dashboard access unlocked',
            'Menu and billing are now live',
          ].map((item) => (
            <div key={item} className="flex items-center gap-2.5">
              <Sparkles size={13} className="text-orange-400 flex-shrink-0" />
              <span className="text-sm text-zinc-300">{item}</span>
            </div>
          ))}
        </div>

        <p className="text-xs text-zinc-600">Redirecting to dashboard in a moment…</p>
      </div>
    </div>
  )
}