'use client'

import { motion } from 'framer-motion'
import { ArrowRight, BarChart3, Gift, MessageCircle, QrCode, RotateCcw, Search, Sparkles } from 'lucide-react'
import { useEffect, useState } from 'react'

const steps = [
  { label: 'Scan', body: 'Guest enters from your QR code.', icon: QrCode },
  { label: 'Choose', body: 'Guests browse, ask and decide faster.', icon: Search },
  { label: 'Engage', body: 'You can stay connected after the visit.', icon: MessageCircle },
  { label: 'Return', body: 'Rewards and follow-up create another reason to visit.', icon: RotateCcw },
]

export function AnimatedGrowthLoop() {
  const [active, setActive] = useState(0)

  useEffect(() => {
    const timer = window.setInterval(() => setActive((value) => (value + 1) % steps.length), 2600)
    return () => window.clearInterval(timer)
  }, [])

  return (
    <div className="relative overflow-hidden rounded-[32px] border border-white/10 bg-[#14120f] p-5 shadow-[0_30px_90px_rgba(0,0,0,0.25)] sm:p-8">
      <div className="pointer-events-none absolute -right-24 top-0 h-64 w-64 rounded-full bg-[#e5bd66]/8 blur-3xl" />
      <div className="relative">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/35">The Dinezy loop</p>
            <p className="mt-2 font-display text-xl font-semibold text-white sm:text-2xl">The menu is only the beginning.</p>
          </div>
          <div className="hidden h-10 w-10 place-items-center rounded-full border border-white/10 bg-white/[0.04] text-[#e5bd66] sm:grid">
            <Sparkles size={17} />
          </div>
        </div>

        <div className="relative mt-8">
          <div className="absolute left-6 right-6 top-6 hidden h-px bg-white/8 sm:block" />
          <motion.div
            className="absolute left-6 top-6 hidden h-px bg-[#e5bd66] sm:block"
            animate={{ width: `${(active / (steps.length - 1)) * 100}%` }}
            transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
            style={{ maxWidth: 'calc(100% - 48px)' }}
          />

          <div className="grid gap-3 sm:grid-cols-4">
            {steps.map((step, index) => {
              const Icon = step.icon
              const isActive = index === active
              return (
                <button
                  type="button"
                  key={step.label}
                  onClick={() => setActive(index)}
                  className={`relative text-left transition-all duration-300 ${isActive ? 'translate-y-0' : 'translate-y-1 opacity-65 hover:opacity-90'}`}
                >
                  <motion.div
                    animate={{ scale: isActive ? 1.06 : 1 }}
                    className={`relative z-10 grid h-12 w-12 place-items-center rounded-2xl border ${isActive ? 'border-[#e5bd66] bg-[#e5bd66] text-[#18130c]' : 'border-white/10 bg-[#191613] text-white/45'}`}
                  >
                    <Icon size={18} />
                  </motion.div>
                  <p className="mt-4 text-xs font-bold uppercase tracking-[0.14em] text-white">{step.label}</p>
                  <p className="mt-2 text-xs leading-5 text-white/42">{step.body}</p>
                  {index < steps.length - 1 ? <ArrowRight size={14} className="mt-3 text-white/20 sm:hidden" /> : null}
                </button>
              )
            })}
          </div>
        </div>

        <motion.div
          key={active}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="mt-8 grid gap-3 sm:grid-cols-3"
        >
          <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
            <QrCode size={16} className="text-[#e5bd66]" />
            <p className="mt-3 text-xs font-semibold text-white">Better first interaction</p>
            <p className="mt-1.5 text-[11px] leading-5 text-white/38">A faster, clearer menu experience at the table.</p>
          </div>
          <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
            <Gift size={16} className="text-[#e5bd66]" />
            <p className="mt-3 text-xs font-semibold text-white">More reasons to return</p>
            <p className="mt-1.5 text-[11px] leading-5 text-white/38">Use loyalty and follow-up to keep the relationship going.</p>
          </div>
          <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
            <BarChart3 size={16} className="text-[#e5bd66]" />
            <p className="mt-3 text-xs font-semibold text-white">Know what is working</p>
            <p className="mt-1.5 text-[11px] leading-5 text-white/38">See menu activity and engagement from one dashboard.</p>
          </div>
        </motion.div>
      </div>
    </div>
  )
}
