'use client'

import { motion } from 'framer-motion'
import {
  BarChart3,
  Gift,
  LayoutGrid,
  MessageCircle,
  Sparkles,
  Star,
  Users,
} from 'lucide-react'
import { FadeIn, SectionHeading, SectionLead, SectionShell } from './shared'

const NODES = [
  { icon: LayoutGrid, label: 'Menu' },
  { icon: Sparkles, label: 'AI' },
  { icon: MessageCircle, label: 'WhatsApp' },
  { icon: Gift, label: 'Loyalty' },
  { icon: Star, label: 'Reviews' },
  { icon: BarChart3, label: 'Analytics' },
]

export function Ecosystem() {
  return (
    <SectionShell id="ecosystem" dark className="bg-[#0a0a0a]">
      <FadeIn className="mx-auto max-w-2xl text-center">
        <SectionHeading className="text-white">
          One platform. Every touchpoint.
        </SectionHeading>
        <SectionLead dark className="mx-auto">
          Dinezy isn&apos;t a menu tool with add-ons. It&apos;s a connected growth engine that links
          every guest interaction back to repeat visits.
        </SectionLead>
      </FadeIn>

      <FadeIn delay={0.1} className="mt-16">
        <div className="relative mx-auto max-w-lg">
          {/* Top: Customer */}
          <div className="flex justify-center">
            <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.05] px-5 py-3">
              <Users size={18} className="text-white/60" />
              <span className="font-display text-[15px] font-semibold">Customer</span>
            </div>
          </div>

          <div className="mx-auto my-3 h-10 w-px bg-gradient-to-b from-white/20 to-accent/50" />

          {/* Center: Dinezy */}
          <div className="flex justify-center">
            <motion.div
              className="relative flex h-20 w-20 items-center justify-center rounded-[1.5rem] bg-accent text-white shadow-[0_0_60px_rgba(122,35,51,0.35)]"
              animate={{ boxShadow: ['0 0 40px rgba(122,35,51,0.25)', '0 0 70px rgba(122,35,51,0.4)', '0 0 40px rgba(122,35,51,0.25)'] }}
              transition={{ duration: 3, repeat: Infinity }}
            >
              <span className="font-display text-2xl font-bold">D</span>
            </motion.div>
          </div>

          <div className="mx-auto my-3 h-10 w-px bg-gradient-to-b from-accent/50 to-white/20" />

          {/* Nodes grid */}
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
            {NODES.map((node, i) => (
              <motion.div
                key={node.label}
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.06 }}
                className="flex flex-col items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] p-3"
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/10 text-accent-50">
                  <node.icon size={15} />
                </div>
                <span className="text-[10px] font-semibold uppercase tracking-wider text-white/50">
                  {node.label}
                </span>
              </motion.div>
            ))}
          </div>

          <div className="mx-auto my-3 h-10 w-px bg-gradient-to-b from-white/20 to-accent/50" />

          {/* Bottom: Repeat visit */}
          <div className="flex justify-center">
            <div className="rounded-2xl border border-accent/30 bg-accent/10 px-6 py-3">
              <span className="font-display text-[15px] font-semibold text-accent-50">
                Repeat visit
              </span>
            </div>
          </div>
        </div>
      </FadeIn>
    </SectionShell>
  )
}
