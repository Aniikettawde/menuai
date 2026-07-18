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
    q: 'What are the pre-approved WhatsApp templates?',
    a: 'Ready-written, Meta-approved messages — like a free-coffee or 20%-off nudge for guests who haven\u2019t visited in a while — so you never have to write a win-back message yourself.',
  },
  {
    q: 'Do I need my own WhatsApp Business account?',
    a: 'You need a phone number to register one, which Meta provides for free. Dinezy handles the technical connection during onboarding.',
  },
  {
    q: 'What are Dinezy Points?',
    a: 'A redeemable rewards system — guests earn points on every visit, verified with a simple PIN at the table, and redeem them for a free item or discount. It gives regulars a reason to return, and gives new guests a reason to try you.',
  },
  {
    q: 'How do the offers like free coffee or % off actually work?',
    a: 'You choose the offer and who it targets — a first-time guest, a regular, or someone who hasn\u2019t visited lately — and Dinezy sends it over WhatsApp automatically. Offers are funded by Dinezy, not deducted from your margin.',
  },
  {
    q: 'How does Dinezy help me get more reviews?',
    a: 'After a guest\u2019s visit, a timed WhatsApp message asks them to leave a review while the experience is still fresh — turning happy guests into public reviews without your staff having to ask in person.',
  },
  {
    q: 'Can I update my menu myself?',
    a: 'Yes. Add a dish, mark something sold out, or change a price from your phone — it goes live everywhere within seconds.',
  },
  {
    q: 'What does the AI Menu Assistant actually do?',
    a: 'It answers guest questions directly from your menu — what pairs well with a dish, what\u2019s spicy, what\u2019s vegetarian — without your staff needing to explain it each time.',
  },
  {
    q: 'What can I see on the analytics dashboard?',
    a: 'QR scans, repeat customers, most-viewed dishes, peak hours, and how many visits came through the Dinezy network versus walk-ins.',
  },
  {
    q: 'Is there a long-term contract?',
    a: 'No. Dinezy runs on a simple annual subscription with a one-time setup fee, and you can cancel between renewal periods.',
  },
  {
    q: 'Can Dinezy support more than one location?',
    a: 'Yes. Restaurant groups can run multiple venues under one account with consolidated analytics — reach out for multi-location pricing.',
  },
  {
    q: 'What support do I get after signing up?',
    a: 'A dedicated onboarding call, WhatsApp support for day-to-day questions, and typically a response within two hours during business hours.',
  },
]

export function FAQ() {
  const [open, setOpen] = useState<number | null>(0)

  return (
    <section id="faq" className="bg-white py-20 sm:py-28">
      <div className="mx-auto max-w-content px-5 sm:px-8">
        <Reveal className="mx-auto max-w-xl text-center">
          <p className="mb-3 text-[13px] font-semibold uppercase tracking-[0.14em] text-accent">FAQ</p>
          <h2 className="text-balance text-[1.9rem] font-semibold leading-tight tracking-tight text-ink sm:text-4xl">
            Questions restaurant owners ask.
          </h2>
        </Reveal>

        <div className="mx-auto mt-12 max-w-2xl divide-y divide-line border-y border-line sm:mt-16">
          {FAQS.map((f, i) => {
            const isOpen = open === i
            return (
              <div key={f.q}>
                <button
                  onClick={() => setOpen(isOpen ? null : i)}
                  aria-expanded={isOpen}
                  className="flex w-full items-center justify-between gap-4 py-5 text-left"
                >
                  <span className="text-[15px] font-medium text-ink">{f.q}</span>
                  <span
                    className={`shrink-0 text-lg text-ink-faint transition-transform duration-300 ${isOpen ? 'rotate-45' : ''}`}
                  >
                    +
                  </span>
                </button>
                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.25, ease: 'easeInOut' }}
                      className="overflow-hidden"
                    >
                      <p className="pb-5 text-[14px] leading-relaxed text-ink-soft">{f.a}</p>
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