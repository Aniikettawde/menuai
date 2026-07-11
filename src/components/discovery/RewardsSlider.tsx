'use client'

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { QrCode, Gift, MessageSquareText, Wallet, ChevronLeft, ChevronRight } from 'lucide-react'

interface Slide {
  icon: ReactNode
  step: string
  title: string
  desc: string
  accent: string
}

const SLIDES: Slide[] = [
  {
    icon: <QrCode size={26} />,
    step: 'Step 1',
    title: 'Scan the QR at your table',
    desc: 'Every table has a Dinezy QR — scan it to open the menu and start earning.',
    accent: '#7A1F2B',
  },
  {
    icon: <Gift size={26} />,
    step: 'Step 2',
    title: 'Claim your points',
    desc: 'Tap "Claim Points" after ordering — they land in your account instantly.',
    accent: '#8A6D1F',
  },
  {
    icon: <MessageSquareText size={26} />,
    step: 'Step 3',
    title: 'Give your code to the waiter',
    desc: 'Show your unique claim code to staff to confirm the visit at this table.',
    accent: '#2f7a52',
  },
  {
    icon: <Wallet size={26} />,
    step: 'Step 4',
    title: 'Redeem for an Amazon Pay gift card',
    desc: 'Points granted! Cash them in for a gift card, whenever you like.',
    accent: '#2f6a8a',
  },
]

const AUTOPLAY_MS = 3800

export function RewardsSlider() {
  const [index, setIndex] = useState(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const touchStartX = useRef<number | null>(null)

  const goTo = useCallback((i: number) => setIndex((i + SLIDES.length) % SLIDES.length), [])

  const restartAutoplay = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current)
    timerRef.current = setInterval(() => setIndex((p) => (p + 1) % SLIDES.length), AUTOPLAY_MS)
  }, [])

  useEffect(() => {
    restartAutoplay()
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [restartAutoplay])

  const handleTouchStart = (e: React.TouchEvent) => { touchStartX.current = e.touches[0].clientX }
  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return
    const delta = e.changedTouches[0].clientX - touchStartX.current
    if (Math.abs(delta) > 40) {
      goTo(index + (delta < 0 ? 1 : -1))
      restartAutoplay()
    }
    touchStartX.current = null
  }

  const cur = SLIDES[index]

  return (
    <section className="px-3 pt-3 sm:px-6" aria-label="How Dinezy rewards work">
      <div
        className="relative overflow-hidden rounded-2xl border"
        style={{ borderColor: 'var(--border)', background: 'var(--card)' }}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.08] transition-colors duration-500"
          style={{ background: `radial-gradient(circle at 15% 20%, ${cur.accent}, transparent 60%)` }}
        />

        <div className="relative flex items-center gap-3.5 px-4 py-4 sm:gap-4 sm:px-6 sm:py-5">
          <div
            className="flex shrink-0 items-center justify-center rounded-2xl transition-colors duration-300"
            style={{ width: 50, height: 50, background: `${cur.accent}1a`, color: cur.accent }}
          >
            {cur.icon}
          </div>

          <div className="min-w-0 flex-1">
            <span className="text-[10px] font-bold uppercase tracking-wide" style={{ color: cur.accent }}>
              {cur.step} · Earn Dinezy points
            </span>
            <h3
              className="mt-0.5 truncate text-[14px] font-bold sm:text-[14.5px]"
              style={{ color: 'var(--text)', fontFamily: 'var(--font-display)' }}
            >
              {cur.title}
            </h3>
            <p className="mt-0.5 text-[11.5px] leading-snug sm:text-[12px]" style={{ color: 'var(--text-2)' }}>
              {cur.desc}
            </p>
          </div>

          <div className="hidden shrink-0 items-center gap-1.5 sm:flex">
            <button
              type="button"
              onClick={() => { goTo(index - 1); restartAutoplay() }}
              aria-label="Previous step"
              className="flex items-center justify-center rounded-full"
              style={{ width: 30, height: 30, background: 'rgba(33,30,27,0.05)', color: 'var(--text-2)' }}
            >
              <ChevronLeft size={15} />
            </button>
            <button
              type="button"
              onClick={() => { goTo(index + 1); restartAutoplay() }}
              aria-label="Next step"
              className="flex items-center justify-center rounded-full"
              style={{ width: 30, height: 30, background: 'rgba(33,30,27,0.05)', color: 'var(--text-2)' }}
            >
              <ChevronRight size={15} />
            </button>
          </div>
        </div>

        <div className="relative flex items-center justify-center gap-1.5 pb-3" role="tablist" aria-label="Slide indicators">
          {SLIDES.map((_, i) => (
            <button
              key={i}
              type="button"
              role="tab"
              aria-selected={i === index}
              onClick={() => { goTo(i); restartAutoplay() }}
              aria-label={`Go to step ${i + 1}`}
              className="rounded-full transition-all duration-300"
              style={{ width: i === index ? 16 : 5, height: 5, background: i === index ? 'var(--gold-light)' : 'var(--border-2)' }}
            />
          ))}
        </div>
      </div>
    </section>
  )
}