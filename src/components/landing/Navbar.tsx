'use client'

import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'

const LINKS = [
  { label: 'Features', href: '#features' },
  { label: 'How it Works', href: '#how-it-works' },
  { label: 'WhatsApp', href: '#whatsapp' },
  { label: 'Pricing', href: '#pricing' },
  { label: 'FAQ', href: '#faq' },
]

export function Navbar({ onBookDemo }: { onBookDemo: () => void }) {
  const [scrolled, setScrolled] = useState(false)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    return () => {
      document.body.style.overflow = ''
    }
  }, [open])

  const go = (href: string) => {
    setOpen(false)
    document.querySelector(href)?.scrollIntoView({ behavior: 'smooth' })
  }

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-colors duration-300 ${
        scrolled || open ? 'glass-nav border-b border-line' : 'bg-transparent'
      }`}
    >
      <div className="mx-auto flex h-16 max-w-content items-center justify-between px-5 sm:px-8">
        <a
          href="#top"
          onClick={(e) => {
            e.preventDefault()
            go('#top')
          }}
          className="flex items-center gap-2.5"
          aria-label="Dinezy home"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent text-[13px] font-bold text-white">
            D
          </span>
          <span className="text-[15px] font-semibold tracking-tight text-ink">Dinezy</span>
        </a>

        <nav className="hidden items-center gap-1 lg:flex">
          {LINKS.map((l) => (
            <button
              key={l.label}
              onClick={() => go(l.href)}
              className="rounded-full px-4 py-2 text-[14px] font-medium text-ink-soft transition-colors hover:text-ink"
            >
              {l.label}
            </button>
          ))}
        </nav>

        <div className="hidden lg:block">
          <button
            onClick={onBookDemo}
            className="rounded-full bg-ink px-5 py-2.5 text-[14px] font-semibold text-white transition-transform hover:-translate-y-0.5 hover:bg-accent"
          >
            Book Demo
          </button>
        </div>

        <button
          onClick={() => setOpen((v) => !v)}
          aria-label="Toggle menu"
          aria-expanded={open}
          className="flex h-10 w-10 items-center justify-center rounded-full lg:hidden"
        >
          <span className="relative block h-4 w-5">
            <span
              className={`absolute left-0 top-0 h-[1.5px] w-5 bg-ink transition-transform ${open ? 'translate-y-[7px] rotate-45' : ''}`}
            />
            <span
              className={`absolute left-0 top-[7px] h-[1.5px] w-5 bg-ink transition-opacity ${open ? 'opacity-0' : ''}`}
            />
            <span
              className={`absolute left-0 top-[14px] h-[1.5px] w-5 bg-ink transition-transform ${open ? '-translate-y-[7px] -rotate-45' : ''}`}
            />
          </span>
        </button>
      </div>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: 'easeInOut' }}
            className="overflow-hidden bg-white lg:hidden"
          >
            <div className="flex flex-col gap-1 border-t border-line px-5 py-4">
              {LINKS.map((l) => (
                <button
                  key={l.label}
                  onClick={() => go(l.href)}
                  className="rounded-xl px-3 py-3 text-left text-[15px] font-medium text-ink-soft hover:bg-canvas hover:text-ink"
                >
                  {l.label}
                </button>
              ))}
              <button
                onClick={() => {
                  setOpen(false)
                  onBookDemo()
                }}
                className="mt-2 rounded-full bg-ink px-5 py-3.5 text-center text-[15px] font-semibold text-white"
              >
                Book Demo
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  )
}
