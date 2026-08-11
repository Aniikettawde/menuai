'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { Bell, Search, Sparkles, Tag } from 'lucide-react'
import {
  Eyebrow,
  FadeIn,
  PhoneFrame,
  SectionHeading,
  SectionLead,
  SectionShell,
} from './shared'

const CATEGORIES = ['Starters', 'Mains', 'Desserts', 'Drinks']
const DISHES = [
  { name: 'Paneer Tikka', price: 320, cat: 'Starters', popular: true },
  { name: 'Butter Chicken', price: 380, cat: 'Mains', popular: true },
  { name: 'Dal Makhani', price: 260, cat: 'Mains', popular: false },
  { name: 'Gulab Jamun', price: 120, cat: 'Desserts', popular: false },
]

const FEATURES = [
  { icon: Search, label: 'Search & categories' },
  { icon: Sparkles, label: 'AI recommendations' },
  { icon: Tag, label: 'Live offers' },
  { icon: Bell, label: 'Call waiter' },
]

export function DigitalMenu() {
  const [active, setActive] = useState('Mains')
  const [query, setQuery] = useState('')

  const filtered = DISHES.filter(
    (d) =>
      d.cat === active && d.name.toLowerCase().includes(query.toLowerCase()),
  )

  return (
    <SectionShell id="menu">
      <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
        <FadeIn>
          <Eyebrow>Digital menu</Eyebrow>
          <SectionHeading>
            Your menu should do more than <span className="text-accent">list dishes.</span>
          </SectionHeading>
          <SectionLead>
            A beautiful QR menu that guests actually want to use — searchable, visual, and smart
            enough to guide them to the right order.
          </SectionLead>
          <div className="mt-8 grid grid-cols-2 gap-3">
            {FEATURES.map((f) => (
              <div
                key={f.label}
                className="flex items-center gap-3 rounded-2xl border border-line bg-canvas/60 px-4 py-3"
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent/10 text-accent">
                  <f.icon size={16} />
                </div>
                <span className="text-[13px] font-medium">{f.label}</span>
              </div>
            ))}
          </div>
        </FadeIn>

        <FadeIn delay={0.1}>
          <PhoneFrame label="Menu">
            <div className="bg-canvas/40 p-3">
              <div className="mb-3 flex items-center gap-2 rounded-xl border border-line bg-white px-3 py-2">
                <Search size={14} className="text-ink-faint" />
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search dishes…"
                  className="w-full bg-transparent text-[12px] outline-none placeholder:text-ink-faint"
                  aria-label="Search dishes"
                />
              </div>

              <div className="mb-3 flex gap-1.5 overflow-x-auto pb-1">
                {CATEGORIES.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setActive(c)}
                    className={`shrink-0 rounded-full px-3 py-1.5 text-[11px] font-semibold transition-colors ${
                      active === c
                        ? 'bg-accent text-white'
                        : 'border border-line bg-white text-ink-soft'
                    }`}
                  >
                    {c}
                  </button>
                ))}
              </div>

              <div className="space-y-2">
                {filtered.map((dish, i) => (
                  <motion.div
                    key={dish.name}
                    initial={{ opacity: 0, x: 8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className="flex items-center justify-between rounded-xl border border-line bg-white p-3"
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-accent/20 to-accent/5" />
                      <div>
                        <p className="text-[12px] font-semibold">{dish.name}</p>
                        {dish.popular && (
                          <span className="text-[9px] font-bold uppercase tracking-wide text-accent">
                            Popular
                          </span>
                        )}
                      </div>
                    </div>
                    <span className="text-[12px] font-bold">₹{dish.price}</span>
                  </motion.div>
                ))}
              </div>

              <button
                type="button"
                className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-accent py-2.5 text-[11px] font-semibold text-white"
              >
                <Bell size={12} />
                Call waiter
              </button>
            </div>
          </PhoneFrame>
        </FadeIn>
      </div>
    </SectionShell>
  )
}
