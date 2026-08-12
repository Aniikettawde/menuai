'use client'

import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Menu, X } from 'lucide-react'
import { scrollTo } from './shared'

const LINKS = [
  { label: 'Product', href: '#journey' },
  { label: 'Menu', href: '#menu' },
  { label: 'WhatsApp', href: '#whatsapp' },
  { label: 'Analytics', href: '#analytics' },
  { label: 'Dashboard', href: '#dashboard' },
]

export function Navbar({ onBookDemo }: { onBookDemo: () => void }) {
  const [scrolled, setScrolled] = useState(false)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 16)
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
    scrollTo(href)
  }

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-all duration-300 ${
        scrolled || open
          ? 'border-b border-line/80 bg-white/80 backdrop-blur-xl'
          : 'bg-transparent'
      }`}
    >
      <div className="mx-auto flex h-[68px] max-w-content items-center justify-between px-5 sm:px-8">
        <a
          href="#top"
          onClick={(e) => {
            e.preventDefault()
            go('#top')
          }}
          className="group flex items-center gap-2.5"
          aria-label="Dinezy home"
        >
          <span className="relative flex h-9 w-9 items-center justify-center overflow-hidden rounded-xl bg-ink text-[14px] font-bold text-white">
            <span className="absolute inset-0 bg-gradient-to-br from-accent to-accent-dark opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
            <span className="relative">D</span>
          </span>
          <span className="font-display text-[17px] font-semibold tracking-tight text-ink">Dinezy</span>
        </a>

        <nav className="hidden items-center gap-1 lg:flex" aria-label="Main">
          {LINKS.map((l) => (
            <button
              key={l.label}
              type="button"
              onClick={() => go(l.href)}
              className="cursor-pointer rounded-xl px-3.5 py-2 text-[13px] font-medium text-ink-soft transition-colors hover:bg-canvas hover:text-ink"
            >
              {l.label}
            </button>
          ))}
        </nav>

        <div className="hidden items-center gap-2 lg:flex">
          <a
            href="/dashboard/login"
            className="cursor-pointer rounded-xl px-3.5 py-2 text-[13px] font-medium text-ink-soft transition-colors hover:text-ink"
          >
            Sign in
          </a>
          <button
            type="button"
            onClick={onBookDemo}
            className="cursor-pointer rounded-xl px-3.5 py-2 text-[13px] font-medium text-ink-soft transition-colors hover:text-ink"
          >
            Book a Demo
          </button>
          <a
            href="/dashboard/login?mode=signup"
            className="cursor-pointer rounded-2xl bg-accent px-5 py-2.5 text-[13px] font-semibold text-white shadow-elegant-sm transition-transform hover:-translate-y-0.5"
          >
            Sign up now
          </a>
        </div>

        <button
          type="button"
          className="flex h-10 w-10 items-center justify-center rounded-xl border border-line bg-white lg:hidden"
          onClick={() => setOpen((v) => !v)}
          aria-label={open ? 'Close menu' : 'Open menu'}
        >
          {open ? <X size={18} /> : <Menu size={18} />}
        </button>
      </div>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden border-t border-line bg-white lg:hidden"
          >
            <nav className="flex flex-col gap-1 px-5 py-4">
              {LINKS.map((l) => (
                <button
                  key={l.label}
                  type="button"
                  onClick={() => go(l.href)}
                  className="cursor-pointer rounded-xl px-3 py-3 text-left text-[15px] font-medium text-ink"
                >
                  {l.label}
                </button>
              ))}
              <a
                href="/dashboard/login"
                className="rounded-xl px-3 py-3 text-[15px] font-medium text-ink-soft"
              >
                Sign in
              </a>
              <button
                type="button"
                onClick={() => {
                  setOpen(false)
                  onBookDemo()
                }}
                className="cursor-pointer rounded-xl px-3 py-3 text-left text-[15px] font-medium text-ink"
              >
                Book a Demo
              </button>
              <a
                href="/dashboard/login?mode=signup"
                className="mt-2 cursor-pointer rounded-2xl bg-accent px-4 py-3 text-center text-[15px] font-semibold text-white"
              >
                Sign up now
              </a>
            </nav>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  )
}
