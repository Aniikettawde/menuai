'use client'

import { motion } from 'framer-motion'
import { BarChart3, Eye, QrCode, Repeat, TrendingUp, Users } from 'lucide-react'
import {
  AnimatedCounter,
  Eyebrow,
  FadeIn,
  SectionHeading,
  SectionLead,
  SectionShell,
} from './shared'

const METRICS = [
  { icon: QrCode, label: 'QR scans', value: 2847, suffix: '', change: '+18%' },
  { icon: Eye, label: 'Menu views', value: 6124, suffix: '', change: '+24%' },
  { icon: Repeat, label: 'Repeat visits', value: 42, suffix: '%', change: '+6 pts' },
  { icon: Users, label: 'Engaged guests', value: 891, suffix: '', change: '+31%' },
]

const POPULAR = [
  { name: 'Paneer Tikka', pct: 89 },
  { name: 'Butter Chicken', pct: 76 },
  { name: 'Dal Makhani', pct: 64 },
  { name: 'Veg Biryani', pct: 58 },
]

export function AnalyticsSection() {
  return (
    <SectionShell id="analytics">
      <FadeIn>
        <Eyebrow>Analytics</Eyebrow>
        <SectionHeading>
          Know what your customers <span className="text-accent">actually do.</span>
        </SectionHeading>
        <SectionLead>
          Real restaurant data — not vanity metrics. See what guests browse, what they order, who
          comes back, and which campaigns work.
        </SectionLead>
      </FadeIn>

      <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {METRICS.map((m, i) => (
          <FadeIn key={m.label} delay={i * 0.05}>
            <div className="rounded-2xl border border-line bg-white p-5 shadow-elegant-sm">
              <div className="flex items-center justify-between">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent/10 text-accent">
                  <m.icon size={16} />
                </div>
                <span className="text-[11px] font-semibold text-emerald-600">{m.change}</span>
              </div>
              <p className="mt-4 text-[12px] font-medium text-ink-faint">{m.label}</p>
              <p className="font-display text-2xl font-bold tracking-tight">
                <AnimatedCounter value={m.value} suffix={m.suffix} />
              </p>
            </div>
          </FadeIn>
        ))}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <FadeIn delay={0.1}>
          <div className="rounded-2xl border border-line bg-white p-5 shadow-elegant-sm">
            <div className="mb-4 flex items-center gap-2">
              <BarChart3 size={16} className="text-accent" />
              <p className="text-[13px] font-semibold">Popular dishes</p>
            </div>
            <div className="space-y-3">
              {POPULAR.map((d, i) => (
                <div key={d.name}>
                  <div className="mb-1 flex justify-between text-[12px]">
                    <span className="font-medium">{d.name}</span>
                    <span className="text-ink-faint">{d.pct}%</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-canvas">
                    <motion.div
                      className="h-full rounded-full bg-accent"
                      initial={{ width: 0 }}
                      whileInView={{ width: `${d.pct}%` }}
                      viewport={{ once: true }}
                      transition={{ delay: i * 0.1, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </FadeIn>

        <FadeIn delay={0.15}>
          <div className="rounded-2xl border border-line bg-white p-5 shadow-elegant-sm">
            <div className="mb-4 flex items-center gap-2">
              <TrendingUp size={16} className="text-accent" />
              <p className="text-[13px] font-semibold">Campaign performance</p>
            </div>
            <div className="flex h-[180px] items-end gap-2">
              {[40, 65, 45, 80, 55, 90, 70].map((h, i) => (
                <motion.div
                  key={i}
                  className="flex-1 rounded-t-lg bg-accent/20"
                  initial={{ height: 0 }}
                  whileInView={{ height: `${h}%` }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.06, duration: 0.6 }}
                >
                  <motion.div
                    className="h-full w-full rounded-t-lg bg-accent"
                    initial={{ opacity: 0 }}
                    whileInView={{ opacity: 1 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.3 + i * 0.06 }}
                    style={{ height: `${60 + (i % 3) * 10}%` }}
                  />
                </motion.div>
              ))}
            </div>
            <p className="mt-3 text-[11px] text-ink-faint">WhatsApp win-back campaign · Last 7 days</p>
          </div>
        </FadeIn>
      </div>
    </SectionShell>
  )
}
