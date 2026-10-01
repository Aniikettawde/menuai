'use client'

import { motion } from 'framer-motion'
import {
  BarChart3,
  Gift,
  MessageCircle,
  QrCode,
  Sparkles,
  Star,
  UtensilsCrossed,
} from 'lucide-react'
import { PrimaryButton, SecondaryButton } from './shared'

const FLOATS = [
  {
    icon: MessageCircle,
    label: 'WhatsApp',
    value: 'Win-back sent',
    className: 'left-[-8%] top-[18%] sm:left-[-12%]',
    delay: 0,
  },
  {
    icon: Gift,
    label: 'Loyalty',
    value: '+120 pts',
    className: 'right-[-6%] top-[12%] sm:right-[-10%]',
    delay: 0.15,
  },
  {
    icon: BarChart3,
    label: 'Analytics',
    value: '42% repeat',
    className: 'bottom-[22%] left-[-10%] sm:left-[-14%]',
    delay: 0.3,
  },
  {
    icon: Star,
    label: 'Reviews',
    value: '4.8 avg',
    className: 'bottom-[18%] right-[-8%] sm:right-[-12%]',
    delay: 0.45,
  },
]

const MENU_ITEMS = [
  { name: 'Paneer Tikka', price: '₹320', tag: 'Popular' },
  { name: 'Veg Biryani', price: '₹280', tag: 'Chef pick' },
  { name: 'Masala Dosa', price: '₹180', tag: null },
]

export function Hero({ onBookDemo }: { onBookDemo: () => void }) {
  return (
    <section
      id="top"
      className="relative min-h-[100svh] overflow-hidden bg-ink pt-[68px] text-white"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_70%_20%,rgba(122,35,51,0.22),transparent_55%)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.35]"
        style={{
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px)',
          backgroundSize: '72px 72px',
          maskImage: 'radial-gradient(ellipse 80% 70% at 50% 40%, black, transparent)',
        }}
      />

      <div className="relative z-10 mx-auto grid max-w-content items-center gap-12 px-5 py-16 sm:px-8 lg:min-h-[calc(100svh-68px)] lg:grid-cols-[1fr_1.05fr] lg:gap-8 lg:py-20">
        <div className="max-w-xl">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/45">
            Restaurant growth platform
          </p>
          <h1 className="mt-5 font-display text-[clamp(2.75rem,7vw,4.75rem)] font-semibold leading-[0.98] tracking-[-0.04em]">
            Turn diners into <span className="text-accent-50">regulars.</span>
          </h1>
          <p className="mt-5 max-w-md text-[16px] leading-relaxed text-white/60 sm:text-[17px]">
            Dinezy gives restaurants everything they need to create better guest experiences,
            build customer relationships, and bring diners back.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <PrimaryButton href="/dashboard/login?mode=signup">Sign up now</PrimaryButton>
            <SecondaryButton dark onClick={onBookDemo}>
              Book a Demo
            </SecondaryButton>
          </div>
          <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-[12px] font-medium text-white/40">
            {['QR menu to retention', 'Your WhatsApp', 'No guest app'].map((t) => (
              <li key={t} className="flex items-center gap-2">
                <span className="h-1 w-1 rounded-full bg-accent" />
                {t}
              </li>
            ))}
          </ul>
        </div>

        <div className="relative mx-auto w-full max-w-[420px] lg:max-w-none">
          <div className="relative mx-auto w-[280px] sm:w-[300px]">
            <div className="relative rounded-[2.5rem] border border-white/10 bg-white/5 p-2.5 shadow-[0_40px_100px_rgba(0,0,0,0.45)] backdrop-blur-sm">
              <div className="absolute left-1/2 top-4 z-20 h-[24px] w-[96px] -translate-x-1/2 rounded-full bg-black/80" />
              <div className="overflow-hidden rounded-[2rem] bg-white text-ink">
                <div className="flex items-center justify-between border-b border-line px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-accent/10 text-accent">
                      <UtensilsCrossed size={14} />
                    </div>
                    <div>
                      <p className="text-[12px] font-semibold">Spice Route Kitchen</p>
                      <p className="text-[10px] text-ink-faint">Table 7 · QR Menu</p>
                    </div>
                  </div>
                  <QrCode size={16} className="text-ink-faint" />
                </div>

                <div className="border-b border-line bg-canvas/60 px-4 py-2.5">
                  <div className="flex items-center gap-2 rounded-xl border border-line bg-white px-3 py-2 text-[11px] text-ink-faint">
                    <Sparkles size={12} className="text-accent" />
                    Ask Dinezy what to order…
                  </div>
                </div>

                <div className="space-y-0 px-1 py-1">
                  {MENU_ITEMS.map((item) => (
                    <div
                      key={item.name}
                      className="flex items-center justify-between border-b border-line/70 px-3 py-3 last:border-0"
                    >
                      <div>
                        <p className="text-[12px] font-semibold">{item.name}</p>
                        {item.tag && (
                          <span className="mt-0.5 inline-block rounded-md bg-accent/10 px-1.5 py-0.5 text-[9px] font-semibold text-accent">
                            {item.tag}
                          </span>
                        )}
                      </div>
                      <span className="text-[12px] font-bold text-ink">{item.price}</span>
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-3 gap-2 border-t border-line p-3">
                  {['Search', 'Offers', 'Call waiter'].map((a) => (
                    <button
                      key={a}
                      type="button"
                      className="rounded-xl border border-line bg-canvas py-2 text-[10px] font-semibold text-ink-soft"
                    >
                      {a}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {FLOATS.map((card) => (
              <motion.div
                key={card.label}
                className={`absolute hidden w-[148px] rounded-2xl border border-white/10 bg-white/[0.07] p-3 backdrop-blur-md sm:block ${card.className}`}
                animate={{ y: [0, -6, 0] }}
                transition={{ duration: 4 + card.delay * 2, repeat: Infinity, ease: 'easeInOut' }}
              >
                <div className="flex items-center gap-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent/20 text-accent-50">
                    <card.icon size={13} />
                  </div>
                  <div>
                    <p className="text-[10px] font-medium text-white/50">{card.label}</p>
                    <p className="text-[12px] font-semibold">{card.value}</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
