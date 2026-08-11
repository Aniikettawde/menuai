'use client'

import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Reveal } from './Reveal'

const FAQS = [
  {
    q: 'How long does it take to go live?',
    a: 'Most restaurants are live within 30 minutes of their onboarding call. We upload your menu, generate table QR codes and connect WhatsApp the same day.',
  },
  {
    q: 'Do guests need to download an app?',
    a: 'No. Guests scan a QR code and everything opens in their phone\u2019s browser — the menu, offers and Dinezy Points, with nothing to install.',
  },
  {
    q: 'Does Dinezy take live orders or handle table booking?',
    a: 'Not currently. Dinezy focuses on your menu, WhatsApp engagement and repeat-visit rewards — it doesn\u2019t take live orders or manage table reservations.',
  },
  {
    q: 'Is this different from Zomato or Swiggy?',
    a: 'Yes. Dinezy is built for your own dine-in guests, not food delivery. There\u2019s no commission on your revenue, and every customer relationship stays yours.',
  },
  {
    q: 'How does WhatsApp automation work?',
    a: 'You connect your own WhatsApp Business number through Meta\u2019s official Embedded Signup. Once a guest has finished their meal and gone home, Dinezy sends win-back offers and review requests on your behalf — automatically.',
  },
  {
    q: 'What are Dinezy Points?',
    a: 'A redeemable rewards system — guests earn points on every visit, verified with a simple PIN at the table, and redeem them for a free item or discount.',
  },
  {
    q: 'Is there a long-term contract?',
    a: 'No. Dinezy runs on a simple annual subscription with a one-time setup fee, and you can cancel between renewal periods.',
  },
  {
    q: 'Can Dinezy support more than one location?',
    a: 'Yes. Restaurant groups can run multiple venues under one account with consolidated analytics — reach out for multi-location pricing.',
  },
]

export function FAQ() {
  const [open, setOpen] = useState<number | null>(0)

  return (
    <section id="faq" className="bg-white py-20 sm:py-28">
      <div className="mx-auto max-w-content px-5 sm:px-8">
        <Reveal className="mx-auto max-w-xl text-center">
          <p className="mb-3 text-[12px] font-semibold uppercase tracking-[0.16em] text-accent">
            FAQ
          </p>
          <h2 className="font-display text-[1.85rem] font-semibold leading-tight tracking-tight text-ink sm:text-4xl">
            Questions, answered clearly.
          </h2>
        </Reveal>

        <div className="mx-auto mt-12 max-w-2xl space-y-2 sm:mt-14">
          {FAQS.map((item, i) => {
            const isOpen = open === i
            return (
              <div
                key={item.q}
                className="overflow-hidden rounded-2xl border border-line bg-white transition-colors hover:border-accent/25"
              >
                <button
                  onClick={() => setOpen(isOpen ? null : i)}
                  aria-expanded={isOpen}
                  className="flex w-full cursor-pointer items-center justify-between gap-4 px-5 py-4 text-left sm:px-6 sm:py-5"
                >
                  <span className="text-[14px] font-semibold text-ink sm:text-[15px]">{item.q}</span>
                  <motion.span
                    animate={{ rotate: isOpen ? 45 : 0 }}
                    transition={{ duration: 0.2 }}
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-canvas text-ink-soft"
                  >
                    +
                  </motion.span>
                </button>
                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
                      className="overflow-hidden"
                    >
                      <p className="px-5 pb-5 text-[14px] leading-relaxed text-ink-soft sm:px-6">
                        {item.a}
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
