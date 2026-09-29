'use client'

import { AnimatePresence, motion } from 'framer-motion'
import {
  ChevronRight,
  Gift,
  Heart,
  MessageCircle,
  QrCode,
  Search,
  Share2,
  Sparkles,
  Star,
  UtensilsCrossed,
} from 'lucide-react'
import { useEffect, useState } from 'react'

const CATEGORIES = [
  { label: 'Coffee', count: 5 },
  { label: 'Mains', count: 8 },
  { label: 'Desserts', count: 4 },
]

const DISHES = [
  {
    name: 'Latte',
    price: '₹260',
    description: 'Velvety espresso with silky steamed milk, made for a slow first sip.',
    tag: 'Bestseller',
    note: 'Pairs well with a light bite',
    tone: 'from-[#e1b46b] via-[#9c603a] to-[#3b2118]',
  },
  {
    name: 'Mocha',
    price: '₹249',
    description: 'Rich espresso and chocolate with a soft, creamy finish.',
    tag: 'Popular',
    note: 'A guest favourite for something sweeter',
    tone: 'from-[#c58b55] via-[#70432d] to-[#2b1812]',
  },
  {
    name: 'Cappuccino',
    price: '₹240',
    description: 'Balanced espresso, warm milk and a deep roasted finish.',
    tag: null,
    note: 'Try it with a chocolate dessert',
    tone: 'from-[#d29c61] via-[#6c3b25] to-[#251613]',
  },
]

export function PhoneMenuShowcase() {
  const [activeCategory, setActiveCategory] = useState(0)
  const [activeDish, setActiveDish] = useState(0)
  const [liked, setLiked] = useState(false)

  useEffect(() => {
    const categoryTimer = window.setInterval(() => {
      setActiveCategory((value) => (value + 1) % CATEGORIES.length)
    }, 3600)
    const dishTimer = window.setInterval(() => {
      setActiveDish((value) => (value + 1) % DISHES.length)
      setLiked(false)
    }, 4200)

    return () => {
      window.clearInterval(categoryTimer)
      window.clearInterval(dishTimer)
    }
  }, [])

  return (
    <div className="relative mx-auto w-full max-w-[390px] sm:max-w-[420px]">
      <motion.div
        aria-hidden
        className="absolute -inset-12 rounded-full bg-[radial-gradient(circle_at_center,rgba(214,164,74,0.22),transparent_60%)] blur-2xl"
        animate={{ opacity: [0.5, 0.82, 0.5], scale: [0.96, 1.03, 0.96] }}
        transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
      />

      <motion.div
        initial={{ opacity: 0, y: 28, rotateX: 7, rotateY: -7 }}
        animate={{ opacity: 1, y: 0, rotateX: 0, rotateY: 0 }}
        transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
        className="relative mx-auto aspect-[0.505] w-[min(78vw,350px)] overflow-hidden rounded-[42px] border-[7px] border-[#2b2926] bg-[#0f0d0b] shadow-[0_35px_100px_rgba(0,0,0,0.45),0_0_0_1px_rgba(255,255,255,0.08)] sm:w-[350px]"
        style={{ transformStyle: 'preserve-3d' }}
      >
        <div className="absolute left-1/2 top-1.5 z-30 h-5 w-28 -translate-x-1/2 rounded-full bg-black/70" />

        <div className="flex h-full flex-col bg-[#0f0d0b] text-white">
          <div className="px-5 pb-3 pt-10">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[9px] font-semibold uppercase tracking-[0.24em] text-white/38">Dinezy</p>
                <motion.p
                  key={CATEGORIES[activeCategory].label}
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-1 font-display text-[18px] font-semibold"
                >
                  Your menu
                </motion.p>
              </div>
              <div className="grid h-9 w-9 place-items-center rounded-full border border-white/10 bg-white/[0.04]">
                <QrCode size={15} className="text-[#e5bd66]" />
              </div>
            </div>

            <div className="mt-4 flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.035] px-3 py-2.5">
              <Search size={13} className="shrink-0 text-white/35" />
              <span className="text-[11px] text-white/35">Search dishes</span>
            </div>

            <div className="mt-3 flex gap-2 overflow-hidden">
              {CATEGORIES.map((category, index) => {
                const active = index === activeCategory
                return (
                  <button
                    key={category.label}
                    type="button"
                    onClick={() => setActiveCategory(index)}
                    className={`shrink-0 rounded-full border px-3.5 py-2 text-[10px] font-semibold transition-all duration-300 ${
                      active
                        ? 'border-[#e5bd66] bg-[#e5bd66] text-[#18130c]'
                        : 'border-white/10 bg-white/[0.025] text-white/45'
                    }`}
                  >
                    {category.label}
                    <span className="ml-1.5 opacity-60">{category.count}</span>
                  </button>
                )
              })}
            </div>
          </div>

          <div className="flex-1 overflow-hidden px-2.5 pb-20">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeDish}
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
                className="px-0.5"
              >
                <div className="overflow-hidden rounded-[24px] border border-[#8c6a28]/60 bg-[#15110d]">
                  <div className="relative h-[190px] overflow-hidden">
                    <motion.div
                      className={`absolute inset-0 bg-gradient-to-br ${DISHES[activeDish].tone}`}
                      animate={{ scale: [1, 1.06, 1], x: [0, -5, 0], y: [0, 4, 0] }}
                      transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
                    />
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_30%,rgba(255,240,185,0.5),transparent_26%),radial-gradient(circle_at_35%_65%,rgba(0,0,0,0.15),transparent_40%)]" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-transparent to-black/10" />
                    <div className="absolute bottom-4 left-4 rounded-full border border-white/20 bg-black/25 px-3 py-1 text-[9px] font-semibold tracking-[0.12em] text-white/85 backdrop-blur">
                      MENU PREVIEW
                    </div>
                  </div>

                  <div className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        {DISHES[activeDish].tag ? (
                          <span className="inline-flex rounded-full bg-[#e5bd66] px-2.5 py-1 text-[8px] font-extrabold uppercase tracking-[0.08em] text-[#20170c]">
                            ★ {DISHES[activeDish].tag}
                          </span>
                        ) : null}
                        <div className="mt-2 flex items-center gap-2">
                          <span className="inline-block h-2 w-2 rounded-sm border border-emerald-400/60 bg-emerald-400/10" />
                          <h3 className="font-display text-[21px] font-semibold tracking-tight">{DISHES[activeDish].name}</h3>
                        </div>
                      </div>
                      <span className="font-display text-[21px] font-semibold text-[#e8c56f]">{DISHES[activeDish].price}</span>
                    </div>

                    <p className="mt-2 text-[10px] leading-5 text-white/52">{DISHES[activeDish].description}</p>

                    <motion.button
                      type="button"
                      whileTap={{ scale: 0.97 }}
                      className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-[#e5bd66]/45 bg-[#e5bd66]/7 px-3 py-2 text-[9px] font-semibold text-[#e5bd66]"
                    >
                      <Sparkles size={11} /> Explain this dish
                    </motion.button>

                    <p className="mt-3 text-[9px] text-white/34">↳ {DISHES[activeDish].note}</p>
                  </div>

                  <div className="flex items-center justify-between border-t border-white/8 px-4 py-3 text-[9px] text-white/42">
                    <span className="font-semibold text-[#e5bd66]">View dish</span>
                    <span>★ 4.8 · guest feedback</span>
                  </div>

                  <div className="flex items-center justify-between border-t border-white/8 px-4 py-2.5">
                    <div className="flex items-center gap-3 text-white/38">
                      <span className="inline-flex items-center gap-1"><Star size={12} />4.8</span>
                      <span className="inline-flex items-center gap-1"><Share2 size={12} />Share</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <button type="button" onClick={() => setLiked((value) => !value)} aria-label="Like dish">
                        <Heart size={14} className={liked ? 'fill-[#e5bd66] text-[#e5bd66]' : 'text-white/30'} />
                      </button>
                      <MessageCircle size={14} className="text-white/30" />
                    </div>
                  </div>
                </div>
              </motion.div>
            </AnimatePresence>
          </div>

          <div className="absolute inset-x-2.5 bottom-2 flex h-14 items-center justify-around rounded-[19px] border border-white/10 bg-[#16120f]/96 px-3 shadow-[0_14px_40px_rgba(0,0,0,0.35)] backdrop-blur-xl">
            {[
              ['Menu', UtensilsCrossed, true],
              ['Ask', Sparkles, false],
              ['Waiter', MessageCircle, false],
            ].map(([label, Icon, active]) => {
              const Component = Icon as typeof UtensilsCrossed
              return (
                <div key={label as string} className={`flex w-20 flex-col items-center gap-1.5 text-[8px] font-semibold ${active ? 'text-[#f0cb76]' : 'text-white/30'}`}>
                  <Component size={14} />
                  <span>{label as string}</span>
                </div>
              )
            })}
          </div>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, x: 25 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.55, duration: 0.7 }}
        className="absolute -right-4 top-[22%] hidden w-36 rounded-2xl border border-white/10 bg-[#191714]/95 p-3 shadow-[0_18px_50px_rgba(0,0,0,0.28)] backdrop-blur-xl sm:block"
      >
        <div className="flex items-center gap-2">
          <div className="grid h-7 w-7 place-items-center rounded-lg bg-[#e5bd66]/10 text-[#e5bd66]">
            <Sparkles size={13} />
          </div>
          <div>
            <p className="text-[9px] font-semibold text-white/45">Dinezy AI</p>
            <p className="text-[10px] font-semibold text-white">Helps guests choose</p>
          </div>
        </div>
        <div className="mt-2 rounded-xl bg-white/[0.04] px-2.5 py-2 text-[8px] leading-4 text-white/45">
          “Something light, spicy and vegetarian?”
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, x: -25 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.72, duration: 0.7 }}
        className="absolute -left-5 bottom-[18%] hidden w-36 rounded-2xl border border-white/10 bg-[#191714]/95 p-3 shadow-[0_18px_50px_rgba(0,0,0,0.28)] backdrop-blur-xl sm:block"
      >
        <div className="flex items-center gap-2">
          <div className="grid h-7 w-7 place-items-center rounded-lg bg-white/[0.06] text-white/60">
            <QrCode size={13} />
          </div>
          <div>
            <p className="text-[9px] font-semibold text-white/45">Guest entry</p>
            <p className="text-[10px] font-semibold text-white">Scan → menu</p>
          </div>
        </div>
        <div className="mt-2 flex items-center justify-between rounded-xl bg-white/[0.04] px-2.5 py-2 text-[8px] text-white/35">
          <span>No app needed</span>
          <ChevronRight size={11} />
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.86, duration: 0.7 }}
        className="absolute bottom-[3%] right-[-4%] hidden w-44 rounded-2xl border border-white/10 bg-[#191714]/95 p-3 shadow-[0_18px_50px_rgba(0,0,0,0.28)] backdrop-blur-xl sm:block"
      >
        <div className="flex items-center gap-2">
          <div className="grid h-7 w-7 place-items-center rounded-lg bg-[#e5bd66]/10 text-[#e5bd66]">
            <Gift size={13} />
          </div>
          <div>
            <p className="text-[9px] font-semibold text-white/45">After the meal</p>
            <p className="text-[10px] font-semibold text-white">Give them a reason to return</p>
          </div>
        </div>
        <div className="mt-2 flex items-center gap-1.5 text-[8px] text-white/35">
          <span className="rounded-full bg-white/[0.05] px-2 py-1">Loyalty</span>
          <span className="rounded-full bg-white/[0.05] px-2 py-1">WhatsApp</span>
        </div>
      </motion.div>
    </div>
  )
}
