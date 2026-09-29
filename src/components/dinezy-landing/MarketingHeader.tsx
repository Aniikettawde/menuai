'use client'

import { AnimatePresence, motion } from 'framer-motion'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ArrowUpRight, Menu, QrCode, X } from 'lucide-react'
import { useEffect, useState } from 'react'

const NAV = [
  { label: 'Digital Menu', href: '/restaurant-digital-menu' },
  { label: 'QR Menu', href: '/restaurant-qr-menu' },
  { label: 'Marketing', href: '/restaurant-marketing' },
  { label: 'AI Menu', href: '/ai-menu-assistant' },
  { label: 'Blog', href: '/blog' },
]

export function MarketingHeader() {
  const [open, setOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const pathname = usePathname()
  const isHome = pathname === '/'

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20)
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

  const navClass = isHome
    ? 'text-white/55 hover:bg-white/[0.06] hover:text-white'
    : 'text-[#665d55] hover:bg-[#f3eee7] hover:text-[#171411]'

  return (
    <>
      <header
        className={`fixed inset-x-0 top-0 z-50 transition-all duration-500 ${
          isHome
            ? scrolled || open
              ? 'border-b border-white/8 bg-[#171411]/88 shadow-[0_10px_40px_rgba(0,0,0,0.16)] backdrop-blur-xl'
              : 'bg-transparent'
            : 'border-b border-[#e8e0d5] bg-[#fcfaf7]/90 shadow-[0_10px_40px_rgba(43,33,24,0.05)] backdrop-blur-xl'
        }`}
      >
        <div className="mx-auto flex h-[76px] max-w-7xl items-center justify-between px-5 sm:px-7">
          <Link href="/" className="group flex items-center gap-2.5" aria-label="Dinezy home">
            <span
              className={`grid h-9 w-9 place-items-center rounded-xl text-sm font-bold transition duration-300 group-hover:scale-105 ${
                isHome ? 'bg-white text-[#171411]' : 'bg-[#171411] text-white'
              }`}
            >
              D
            </span>
            <span className={`font-display text-[17px] font-semibold tracking-tight ${isHome ? 'text-white' : 'text-[#171411]'}`}>
              Dinezy
            </span>
          </Link>

          <nav className="hidden items-center gap-1 lg:flex" aria-label="Primary navigation">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`rounded-full px-3.5 py-2 text-[12px] font-medium transition duration-300 ${navClass}`}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="hidden items-center gap-2 lg:flex">
            <Link
              href="/dashboard/login"
              className={`rounded-full px-3.5 py-2 text-[12px] font-medium transition ${
                isHome ? 'text-white/55 hover:text-white' : 'text-[#665d55] hover:text-[#171411]'
              }`}
            >
              Sign in
            </Link>
            <Link
              href="/dashboard/login?mode=signup"
              className="inline-flex items-center gap-2 rounded-full bg-[#e5bd66] px-4 py-2.5 text-[12px] font-semibold text-[#1e180f] transition hover:-translate-y-0.5"
            >
              Start free
              <ArrowUpRight size={14} />
            </Link>
          </div>

          <button
            type="button"
            aria-label={open ? 'Close navigation' : 'Open navigation'}
            aria-expanded={open}
            onClick={() => setOpen((value) => !value)}
            className={`grid h-10 w-10 place-items-center rounded-xl border lg:hidden ${
              isHome ? 'border-white/12 bg-white/[0.04] text-white' : 'border-[#e8e0d5] bg-white text-[#171411]'
            }`}
          >
            {open ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
      </header>

      <AnimatePresence>
        {open ? (
          <motion.div
            initial={{ opacity: 0, y: -15, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -15, scale: 0.98 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="fixed inset-x-3 top-[84px] z-40 rounded-3xl border border-[#e6dcd0] bg-[#fcfaf7] p-3 shadow-[0_28px_80px_rgba(0,0,0,0.2)] lg:hidden"
          >
            {NAV.map((item, index) => (
              <motion.div
                key={item.href}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.04, duration: 0.3 }}
              >
                <Link
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className="flex items-center justify-between rounded-2xl px-4 py-3.5 text-sm font-semibold text-[#27201a] hover:bg-[#f3ede6]"
                >
                  {item.label}
                  <ArrowUpRight size={14} className="text-[#978c81]" />
                </Link>
              </motion.div>
            ))}
            <div className="my-2 border-t border-[#ebe2d8]" />
            <Link
              href="/qr-generator"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 rounded-2xl px-4 py-3.5 text-sm font-semibold text-[#7a2333] hover:bg-[#faf0f2]"
            >
              <QrCode size={16} />
              Free QR code generator
            </Link>
            <Link
              href="/dashboard/login?mode=signup"
              onClick={() => setOpen(false)}
              className="mt-1 block rounded-2xl bg-[#171411] px-4 py-3.5 text-center text-sm font-semibold text-white"
            >
              Start free
            </Link>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </>
  )
}
