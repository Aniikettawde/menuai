'use client'

import { motion } from 'framer-motion'
import { Reveal } from './Reveal'
import { stagger, fadeUp } from '@/lib/motion'
import { QrIcon, BellIcon, ChatIcon, HeartIcon, GiftIcon, TemplateIcon, StarIcon, SparkleIcon, ChartIcon } from './Icons'

const FEATURES = [
  { Icon: QrIcon, title: 'QR Digital Menu', desc: 'One code per table. Update dishes, prices and photos in seconds — no reprinting.', big: true },
  { Icon: SparkleIcon, title: 'AI Menu Assistant', desc: 'Guests ask what pairs well or what\u2019s spicy, and get a real answer from your own menu.', big: true },
  { Icon: BellIcon, title: 'Call Waiter', desc: 'A single tap tells staff exactly which table needs them, instantly.' },
  { Icon: ChatIcon, title: 'WhatsApp Automation', desc: 'Send updates and answer menu questions on the channel guests already use.' },
  { Icon: HeartIcon, title: 'Dinezy Points', desc: 'Every visit earns redeemable points — a reason for guests to return, and for new guests to try you.' },
  { Icon: GiftIcon, title: 'Win-back Offers', desc: 'A free coffee or 20% off next visit, funded to bring lapsed guests back — not to discount your margin.' },
  { Icon: TemplateIcon, title: 'Pre-approved Templates', desc: 'Ready-made WhatsApp messages that win customers back, so you never have to write one yourself.' },
  { Icon: StarIcon, title: 'Review Campaigns', desc: 'A WhatsApp nudge at the right moment turns happy guests into public reviews.' },
  { Icon: ChartIcon, title: 'Analytics & Insights', desc: 'Scans, repeat visits, top dishes and peak hours, in one screen built for a busy day.' },
]

export function Features() {
  return (
    <section id="features" className="bg-white py-20 sm:py-28">
      <div className="mx-auto max-w-content px-5 sm:px-8">
        <Reveal className="mx-auto max-w-xl text-center">
          <p className="mb-3 text-[13px] font-semibold uppercase tracking-[0.14em] text-accent">Everything in one platform</p>
          <h2 className="text-balance text-[1.9rem] font-semibold leading-tight tracking-tight text-ink sm:text-4xl">
            Replace six tools with one.
          </h2>
        </Reveal>

        {/* Bento grid: the two "big" tiles (QR menu, AI assistant) get double width on
            larger screens — a visual echo of "one platform" replacing many small tools. */}
        <motion.div
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: '-80px' }}
          variants={stagger(0.06)}
          className="mt-12 grid gap-4 sm:mt-16 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3"
        >
          {FEATURES.map((f) => (
            <motion.div
              key={f.title}
              variants={fadeUp}
              className={`group rounded-3xl border border-line p-6 transition-all duration-300 hover:-translate-y-1 hover:border-accent/20 hover:shadow-elegant-md sm:p-7 ${
                f.big ? 'lg:col-span-2' : ''
              }`}
            >
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-accent-50 text-accent transition-transform duration-300 group-hover:scale-110">
                <f.Icon className="h-[22px] w-[22px]" />
              </span>
              <h3 className="mt-5 text-[16px] font-semibold text-ink">{f.title}</h3>
              <p className="mt-2 max-w-md text-[14px] leading-relaxed text-ink-soft">{f.desc}</p>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  )
}