'use client'

import { motion } from 'framer-motion'
import { Reveal } from './Reveal'
import { viewportOnce } from '@/lib/motion'

const NODES = [
  { label: 'Restaurant', sub: 'Your own WhatsApp Business number' },
  { label: 'Meta Authorization', sub: 'Secure Embedded Signup — no passwords shared' },
  { label: 'Dinezy', sub: 'Sends win-back offers and review requests for you' },
  { label: 'Customer', sub: 'Gets a reason to return, on the app they already use' },
]

export function WhatsAppSection() {
  return (
    <section id="whatsapp" className="bg-white py-20 sm:py-28">
      <div className="mx-auto max-w-content px-5 sm:px-8">
        <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
          <Reveal>
            <p className="mb-3 text-[12px] font-semibold uppercase tracking-[0.16em] text-accent">
              WhatsApp Business
            </p>
            <h2 className="font-display text-[1.85rem] font-semibold leading-tight tracking-tight text-ink sm:text-4xl">
              Your own WhatsApp number, automated.
            </h2>
            <p className="mt-5 max-w-md text-[15px] leading-relaxed text-ink-soft">
              Connect through Meta&apos;s official Embedded Signup. Once a guest finishes their meal,
              win-back offers and review requests go out automatically — in your restaurant&apos;s
              name.
            </p>
            <ul className="mt-7 space-y-3">
              {[
                'Connected through Meta, not a third-party number',
                'Pre-approved templates bring lapsed customers back',
                'Timed review requests grow genuine public reviews',
              ].map((t) => (
                <li key={t} className="flex items-start gap-2.5 text-[14px] text-ink-soft">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                  {t}
                </li>
              ))}
            </ul>
          </Reveal>

          <Reveal delay={0.1}>
            <div className="relative rounded-2xl border border-line bg-canvas p-6 sm:p-8">
              <div
                aria-hidden
                className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-accent/10 blur-2xl"
              />
              <div className="relative flex flex-col gap-0">
                {NODES.map((n, i) => (
                  <div key={n.label}>
                    <motion.div
                      initial={{ opacity: 0, y: 12, rotateX: 8 }}
                      whileInView={{ opacity: 1, y: 0, rotateX: 0 }}
                      viewport={viewportOnce}
                      transition={{ duration: 0.45, delay: i * 0.1, ease: 'easeOut' }}
                      className="rounded-2xl border border-line bg-white p-4 shadow-elegant-sm"
                      style={{ transformStyle: 'preserve-3d' }}
                    >
                      <p className="text-[14px] font-semibold text-ink">{n.label}</p>
                      <p className="mt-0.5 text-[12px] text-ink-soft">{n.sub}</p>
                    </motion.div>
                    {i < NODES.length - 1 && (
                      <div className="flex justify-center py-2">
                        <motion.svg
                          width="18"
                          height="24"
                          viewBox="0 0 18 24"
                          fill="none"
                          initial={{ opacity: 0 }}
                          whileInView={{ opacity: 1 }}
                          viewport={viewportOnce}
                          transition={{ delay: i * 0.1 + 0.25 }}
                        >
                          <motion.path
                            d="M9 0 V18 M3 12 L9 18 L15 12"
                            stroke="#7A2333"
                            strokeWidth="1.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            initial={{ pathLength: 0 }}
                            whileInView={{ pathLength: 1 }}
                            viewport={viewportOnce}
                            transition={{ duration: 0.4, delay: i * 0.1 + 0.25 }}
                          />
                        </motion.svg>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  )
}
