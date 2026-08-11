'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  BarChart3,
  Gift,
  LayoutGrid,
  MessageCircle,
  Star,
  Tag,
} from 'lucide-react'
import { FadeIn, SectionHeading, SectionLead, SectionShell } from './shared'

const FRAGMENTS = [
  { icon: LayoutGrid, label: 'Menu' },
  { icon: MessageCircle, label: 'WhatsApp' },
  { icon: Star, label: 'Reviews' },
  { icon: Gift, label: 'Loyalty' },
  { icon: Tag, label: 'Offers' },
  { icon: BarChart3, label: 'Analytics' },
]

export function Problem() {
  const [unified, setUnified] = useState(false)

  return (
    <SectionShell id="problem" className="bg-canvas">
      <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
        <FadeIn>
          <SectionHeading>
            Getting a customer once is hard.
            <br />
            <span className="text-accent">Getting them to come back is harder.</span>
          </SectionHeading>
          <SectionLead>
            Most restaurants juggle disconnected tools — a PDF menu here, WhatsApp messages there,
            loyalty in a notebook, reviews on Google. Nothing talks to each other. Nothing helps you
            bring guests back.
          </SectionLead>
        </FadeIn>

        <FadeIn delay={0.1}>
          <div className="relative rounded-3xl border border-line bg-white p-6 shadow-elegant-md sm:p-8">
            <div className="mb-6 flex items-center justify-between">
              <p className="text-[13px] font-semibold text-ink-soft">
                {unified ? 'One connected platform' : 'Scattered tools today'}
              </p>
              <button
                type="button"
                onClick={() => setUnified((v) => !v)}
                className="cursor-pointer rounded-xl border border-line px-3 py-1.5 text-[12px] font-semibold text-accent transition-colors hover:bg-accent/5"
              >
                {unified ? 'Show problem' : 'See the fix'}
              </button>
            </div>

            <AnimatePresence mode="wait">
              {!unified ? (
                <motion.div
                  key="fragments"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="grid grid-cols-2 gap-3 sm:grid-cols-3"
                >
                  {FRAGMENTS.map((f, i) => (
                    <motion.div
                      key={f.label}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.06 }}
                      className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-line bg-canvas/50 p-4"
                    >
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-ink-soft shadow-elegant-sm">
                        <f.icon size={18} />
                      </div>
                      <span className="text-[12px] font-medium text-ink-soft">{f.label}</span>
                    </motion.div>
                  ))}
                </motion.div>
              ) : (
                <motion.div
                  key="unified"
                  initial={{ opacity: 0, scale: 0.96 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex flex-col items-center py-6"
                >
                  <div className="relative flex h-28 w-28 items-center justify-center rounded-[2rem] bg-ink text-white shadow-elegant-lg">
                    <span className="font-display text-2xl font-bold">D</span>
                    <motion.span
                      className="absolute inset-0 rounded-[2rem] border-2 border-accent/40"
                      animate={{ scale: [1, 1.15, 1], opacity: [0.6, 0, 0.6] }}
                      transition={{ duration: 2.6, repeat: Infinity }}
                    />
                  </div>
                  <p className="mt-5 font-display text-xl font-semibold tracking-tight">
                    Dinezy brings it together.
                  </p>
                  <p className="mt-2 max-w-xs text-center text-[14px] text-ink-soft">
                    Menu, engagement, WhatsApp, loyalty, reviews, and analytics — connected from
                    first scan to repeat visit.
                  </p>
                  <div className="mt-6 flex flex-wrap justify-center gap-2">
                    {FRAGMENTS.map((f) => (
                      <span
                        key={f.label}
                        className="rounded-full border border-accent/15 bg-accent/5 px-3 py-1 text-[11px] font-semibold text-accent"
                      >
                        {f.label}
                      </span>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </FadeIn>
      </div>
    </SectionShell>
  )
}
