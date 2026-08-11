'use client'

import {
  BarChart3,
  Gift,
  LayoutGrid,
  MessageCircle,
  Settings,
  Star,
  Users,
} from 'lucide-react'
import { Eyebrow, FadeIn, SectionHeading, SectionLead, SectionShell } from './shared'

const SIDEBAR = [
  { icon: BarChart3, label: 'Overview', active: true },
  { icon: Users, label: 'Customers' },
  { icon: MessageCircle, label: 'WhatsApp' },
  { icon: LayoutGrid, label: 'Menu' },
  { icon: Gift, label: 'Loyalty' },
  { icon: Star, label: 'Reviews' },
  { icon: Settings, label: 'Settings' },
]

const INSIGHTS = [
  { label: 'Today\'s scans', value: '127' },
  { label: 'Active campaigns', value: '3' },
  { label: 'Pending reviews', value: '8' },
]

const CUSTOMERS = [
  { name: 'Priya S.', visits: 5, last: '2 days ago', tag: 'Regular' },
  { name: 'Arjun K.', visits: 1, last: '12 days ago', tag: 'Win-back' },
  { name: 'Meera P.', visits: 3, last: '5 days ago', tag: 'Loyal' },
]

export function DashboardShowcase() {
  return (
    <SectionShell id="dashboard" className="bg-canvas">
      <FadeIn>
        <Eyebrow>Restaurant dashboard</Eyebrow>
        <SectionHeading>
          Everything in one <span className="text-accent">command center.</span>
        </SectionHeading>
        <SectionLead>
          A real product dashboard — not a marketing mockup. Manage your menu, customers, campaigns,
          loyalty, and reviews from a single place.
        </SectionLead>
      </FadeIn>

      <FadeIn delay={0.1} className="mt-10">
        <div className="overflow-hidden rounded-2xl border border-line bg-white shadow-elegant-lg">
          <div className="flex">
            {/* Sidebar */}
            <div className="hidden w-[200px] shrink-0 border-r border-line bg-ink p-4 sm:block">
              <div className="mb-6 flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent text-[12px] font-bold text-white">
                  D
                </div>
                <span className="font-display text-[14px] font-semibold text-white">Dinezy</span>
              </div>
              <nav className="space-y-1">
                {SIDEBAR.map((item) => (
                  <div
                    key={item.label}
                    className={`flex items-center gap-2.5 rounded-xl px-3 py-2 text-[12px] font-medium ${
                      item.active
                        ? 'bg-white/10 text-white'
                        : 'text-white/45 hover:text-white/70'
                    }`}
                  >
                    <item.icon size={14} />
                    {item.label}
                  </div>
                ))}
              </nav>
            </div>

            {/* Main content */}
            <div className="flex-1 p-4 sm:p-6">
              <div className="mb-5 flex items-center justify-between">
                <div>
                  <p className="text-[15px] font-semibold">Good evening, Raj</p>
                  <p className="text-[12px] text-ink-faint">Spice Route Kitchen · Pune</p>
                </div>
                <span className="rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-semibold text-emerald-700">
                  Live
                </span>
              </div>

              <div className="mb-5 grid grid-cols-3 gap-3">
                {INSIGHTS.map((ins) => (
                  <div key={ins.label} className="rounded-xl border border-line bg-canvas/50 p-3">
                    <p className="text-[10px] font-medium text-ink-faint">{ins.label}</p>
                    <p className="font-display text-xl font-bold">{ins.value}</p>
                  </div>
                ))}
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <div className="rounded-xl border border-line p-4">
                  <p className="mb-3 text-[12px] font-semibold">Recent customers</p>
                  <div className="space-y-2">
                    {CUSTOMERS.map((c) => (
                      <div
                        key={c.name}
                        className="flex items-center justify-between rounded-lg bg-canvas/60 px-3 py-2"
                      >
                        <div>
                          <p className="text-[12px] font-semibold">{c.name}</p>
                          <p className="text-[10px] text-ink-faint">
                            {c.visits} visits · {c.last}
                          </p>
                        </div>
                        <span
                          className={`rounded-md px-2 py-0.5 text-[9px] font-bold uppercase ${
                            c.tag === 'Win-back'
                              ? 'bg-amber-50 text-amber-700'
                              : 'bg-accent/10 text-accent'
                          }`}
                        >
                          {c.tag}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-xl border border-line p-4">
                  <p className="mb-3 text-[12px] font-semibold">Active campaigns</p>
                  <div className="space-y-2">
                    {[
                      { name: 'Weekend win-back', sent: 142, open: '68%' },
                      { name: 'New menu launch', sent: 89, open: '54%' },
                    ].map((camp) => (
                      <div key={camp.name} className="rounded-lg bg-canvas/60 px-3 py-2.5">
                        <div className="flex items-center justify-between">
                          <p className="text-[12px] font-semibold">{camp.name}</p>
                          <span className="text-[10px] text-ink-faint">{camp.open} open rate</span>
                        </div>
                        <p className="text-[10px] text-ink-faint">{camp.sent} messages sent</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </FadeIn>
    </SectionShell>
  )
}
