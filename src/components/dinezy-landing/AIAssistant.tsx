'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Sparkles } from 'lucide-react'
import { Eyebrow, FadeIn, SectionHeading, SectionLead, SectionShell } from './shared'

const MESSAGES = [
  {
    role: 'customer' as const,
    text: 'I want something spicy, vegetarian and good for two.',
  },
  {
    role: 'dinezy' as const,
    text: 'Try the Paneer Tikka and Veg Biryani. They pair well together — one smoky, one hearty. Both are guest favourites this week.',
  },
  {
    role: 'customer' as const,
    text: 'Perfect. Anything to drink with that?',
  },
  {
    role: 'dinezy' as const,
    text: 'A sweet lassi or fresh lime soda balances the spice nicely. Want me to highlight those on the menu?',
  },
]

export function AIAssistant() {
  const [visible, setVisible] = useState(1)

  useEffect(() => {
    if (visible >= MESSAGES.length) return
    const t = setTimeout(() => setVisible((v) => v + 1), 1800)
    return () => clearTimeout(t)
  }, [visible])

  return (
    <SectionShell id="ai" dark className="bg-[#0c0c0c]">
      <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
        <FadeIn>
          <Eyebrow dark>AI food assistant</Eyebrow>
          <SectionHeading className="text-white">
            Not sure what to order?
          </SectionHeading>
          <SectionLead dark>
            Dinezy&apos;s AI helps guests choose — based on taste, dietary needs, and what&apos;s
            popular tonight. It feels like a knowledgeable server, not a chatbot gimmick.
          </SectionLead>
        </FadeIn>

        <FadeIn delay={0.1}>
          <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5 sm:p-6">
            <div className="mb-4 flex items-center gap-2 border-b border-white/10 pb-4">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-accent/20 text-accent-50">
                <Sparkles size={14} />
              </div>
              <div>
                <p className="text-[13px] font-semibold">Dinezy Assistant</p>
                <p className="text-[11px] text-white/40">Helping Table 7</p>
              </div>
            </div>

            <div className="space-y-3" aria-live="polite">
              {MESSAGES.slice(0, visible).map((msg, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4 }}
                  className={`flex ${msg.role === 'customer' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[85%] rounded-2xl px-4 py-3 text-[13px] leading-relaxed ${
                      msg.role === 'customer'
                        ? 'bg-white/10 text-white/90'
                        : 'border border-accent/20 bg-accent/10 text-white'
                    }`}
                  >
                    {msg.role === 'dinezy' && (
                      <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-accent-50/70">
                        Dinezy
                      </span>
                    )}
                    {msg.text}
                  </div>
                </motion.div>
              ))}
            </div>

            <div className="mt-4 flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
              <span className="h-2 w-2 animate-pulse rounded-full bg-accent" />
              <span className="text-[12px] text-white/35">Listening for preferences…</span>
            </div>
          </div>
        </FadeIn>
      </div>
    </SectionShell>
  )
}
