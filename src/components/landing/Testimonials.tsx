'use client'

import { motion } from 'framer-motion'
import { Reveal } from './Reveal'
import { stagger, fadeUp } from '@/lib/motion'

const QUOTES = [
  {
    quote:
      'Our regulars grew noticeably within the first month. The WhatsApp updates alone cut our no-shows in half.',
    name: 'Rahul Deshmukh',
    role: 'Owner, Spice Garden, Pune',
  },
  {
    quote:
      'Staff stopped running across the floor guessing which table needed them. Call Waiter fixed that on day one.',
    name: 'Ananya Kulkarni',
    role: 'Manager, Tandoor House',
  },
  {
    quote:
      'I finally know which dishes actually sell versus which ones just look good on the menu.',
    name: 'Vikram Rao',
    role: 'Owner, Curry Corner',
  },
]

export function Testimonials() {
  return (
    <section className="bg-white py-20 sm:py-28">
      <div className="mx-auto max-w-content px-5 sm:px-8">
        <Reveal className="mx-auto max-w-xl text-center">
          <p className="mb-3 text-[13px] font-semibold uppercase tracking-[0.14em] text-accent">From restaurant owners</p>
          <h2 className="text-balance text-[1.9rem] font-semibold leading-tight tracking-tight text-ink sm:text-4xl">
            What changes, in their words.
          </h2>
        </Reveal>

        <motion.div
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: '-80px' }}
          variants={stagger(0.1)}
          className="mt-12 grid gap-5 sm:mt-16 lg:grid-cols-3"
        >
          {QUOTES.map((q) => (
            <motion.figure
              key={q.name}
              variants={fadeUp}
              className="flex flex-col justify-between rounded-3xl border border-line p-7 transition-all duration-300 hover:-translate-y-1 hover:shadow-elegant-md sm:p-8"
            >
              <span className="mb-3 block font-display text-[2.75rem] leading-none text-accent/25" aria-hidden>
                &ldquo;
              </span>
              <blockquote className="text-[15px] leading-relaxed text-ink">{q.quote}</blockquote>
              <figcaption className="mt-6">
                <p className="text-[14px] font-semibold text-ink">{q.name}</p>
                <p className="text-[13px] text-ink-soft">{q.role}</p>
              </figcaption>
            </motion.figure>
          ))}
        </motion.div>
      </div>
    </section>
  )
}