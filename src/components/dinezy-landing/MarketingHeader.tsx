'use client'

import { AnimatePresence, motion } from 'framer-motion'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  ArrowUpRight,
  Calculator,
  ChevronDown,
  Menu,
  QrCode,
  X,
} from 'lucide-react'
import { useEffect, useState } from 'react'

const NAV = [
  { label: 'Digital Menu', href: '/restaurant-digital-menu' },
  { label: 'QR Menu', href: '/restaurant-qr-menu' },
  { label: 'Marketing', href: '/restaurant-marketing' },
  { label: 'AI Menu', href: '/ai-menu-assistant' },
  { label: 'Blog', href: '/blog' },
]

const TOOLS = [
  {
    href: '/qr-generator',
    title: 'Free QR Code Generator',
    description:
      'Create free custom QR codes with no watermark for links, WhatsApp, WiFi, UPI and more.',
    icon: QrCode,
  },
  {
    href: '/food-cost-calculator',
    title: 'Restaurant Food Cost Calculator',
    description:
      'Calculate recipe cost, food cost percentage, profit and suggested menu pricing.',
    icon: Calculator,
  },
]

export function MarketingHeader() {
  const [open, setOpen] = useState(false)
  const [toolsOpen, setToolsOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)

  const pathname = usePathname()
  const isHome = pathname === '/'

  const isToolsActive =
    pathname === '/qr-generator' ||
    pathname === '/food-cost-calculator'

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

  useEffect(() => {
    setOpen(false)
    setToolsOpen(false)
  }, [pathname])

  const navClass = isHome
    ? 'text-white/55 hover:bg-white/[0.06] hover:text-white'
    : 'text-[#665d55] hover:bg-[#f3eee7] hover:text-[#171411]'

  const toolsButtonClass = isHome
    ? isToolsActive
      ? 'bg-white/[0.08] text-white'
      : 'text-white/55 hover:bg-white/[0.06] hover:text-white'
    : isToolsActive
      ? 'bg-[#f3eee7] text-[#171411]'
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
          <Link
            href="/"
            className="group flex items-center gap-2.5"
            aria-label="Dinezy home"
          >
            <span
              className={`grid h-9 w-9 place-items-center rounded-xl text-sm font-bold transition duration-300 group-hover:scale-105 ${
                isHome ? 'bg-white text-[#171411]' : 'bg-[#171411] text-white'
              }`}
            >
              D
            </span>
            <span
              className={`font-display text-[17px] font-semibold tracking-tight ${
                isHome ? 'text-white' : 'text-[#171411]'
              }`}
            >
              Dinezy
            </span>
          </Link>

          <nav
            className="hidden items-center gap-1 lg:flex"
            aria-label="Primary navigation"
          >
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`rounded-full px-3.5 py-2 text-[12px] font-medium transition duration-300 ${navClass}`}
              >
                {item.label}
              </Link>
            ))}

            <div
              className="relative"
              onMouseEnter={() => setToolsOpen(true)}
              onMouseLeave={() => setToolsOpen(false)}
            >
              <button
                type="button"
                aria-haspopup="true"
                aria-expanded={toolsOpen}
                aria-controls="desktop-tools-menu"
                onClick={() => setToolsOpen((value) => !value)}
                onFocus={() => setToolsOpen(true)}
                className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-[12px] font-medium transition duration-300 ${toolsButtonClass}`}
              >
                Restaurant Tools
                <ChevronDown
                  size={13}
                  aria-hidden="true"
                  className={`transition-transform duration-200 ${
                    toolsOpen ? 'rotate-180' : ''
                  }`}
                />
              </button>

              <AnimatePresence>
                {toolsOpen ? (
                  <motion.div
                    id="desktop-tools-menu"
                    initial={{ opacity: 0, y: 8, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 8, scale: 0.97 }}
                    transition={{
                      duration: 0.18,
                      ease: [0.16, 1, 0.3, 1],
                    }}
                    role="menu"
                    className={`absolute left-1/2 top-[calc(100%+10px)] w-[370px] -translate-x-1/2 overflow-hidden rounded-2xl border p-2 shadow-[0_24px_70px_rgba(0,0,0,0.18)] backdrop-blur-xl ${
                      isHome
                        ? 'border-white/10 bg-[#211e1b]/96'
                        : 'border-[#e8e0d5] bg-[#fcfaf7]/98'
                    }`}
                  >
                    <div className="px-3 pb-2 pt-2">
                      <p
                        className={`text-[10px] font-bold uppercase tracking-[0.18em] ${
                          isHome ? 'text-[#e5bd66]' : 'text-[#7a2333]'
                        }`}
                      >
                        Free restaurant tools
                      </p>
                      <p
                        className={`mt-1 text-[11px] leading-4 ${
                          isHome ? 'text-white/40' : 'text-[#8c8177]'
                        }`}
                      >
                        Free tools for restaurants, cafés, bars and food
                        businesses.
                      </p>
                    </div>

                    <div className="space-y-1">
                      {TOOLS.map((tool) => {
                        const Icon = tool.icon

                        return (
                          <Link
                            key={tool.href}
                            href={tool.href}
                            role="menuitem"
                            className={`group flex items-start gap-3 rounded-xl p-3 transition ${
                              isHome
                                ? 'hover:bg-white/[0.06]'
                                : 'hover:bg-[#f3eee7]'
                            }`}
                          >
                            <span
                              className={`mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl ${
                                isHome
                                  ? 'bg-white/[0.07] text-[#e5bd66]'
                                  : 'bg-[#f4ebe2] text-[#7a2333]'
                              }`}
                            >
                              <Icon size={16} aria-hidden="true" />
                            </span>

                            <span className="min-w-0 flex-1">
                              <span
                                className={`block text-[12px] font-semibold ${
                                  isHome ? 'text-white' : 'text-[#171411]'
                                }`}
                              >
                                {tool.title}
                              </span>
                              <span
                                className={`mt-1 block text-[11px] leading-4 ${
                                  isHome ? 'text-white/38' : 'text-[#8c8177]'
                                }`}
                              >
                                {tool.description}
                              </span>
                            </span>

                            <ArrowUpRight
                              size={14}
                              aria-hidden="true"
                              className={`mt-1 shrink-0 transition-all group-hover:translate-x-0.5 group-hover:-translate-y-0.5 ${
                                isHome ? 'text-white/30' : 'text-[#a3978d]'
                              }`}
                            />
                          </Link>
                        )
                      })}
                    </div>
                  </motion.div>
                ) : null}
              </AnimatePresence>
            </div>
          </nav>

          <div className="hidden items-center gap-2 lg:flex">
            <Link
              href="/dashboard/login"
              className={`rounded-full px-3.5 py-2 text-[12px] font-medium transition ${
                isHome
                  ? 'text-white/55 hover:text-white'
                  : 'text-[#665d55] hover:text-[#171411]'
              }`}
            >
              Sign in
            </Link>

            <Link
              href="/dashboard/login?mode=signup"
              className="inline-flex items-center gap-2 rounded-full bg-[#e5bd66] px-4 py-2.5 text-[12px] font-semibold text-[#1e180f] transition hover:-translate-y-0.5"
            >
              Start free
              <ArrowUpRight size={14} aria-hidden="true" />
            </Link>
          </div>

          <button
            type="button"
            aria-label={open ? 'Close main navigation' : 'Open main navigation'}
            aria-expanded={open}
            aria-controls="mobile-main-navigation"
            onClick={() => setOpen((value) => !value)}
            className={`grid h-10 w-10 place-items-center rounded-xl border lg:hidden ${
              isHome
                ? 'border-white/12 bg-white/[0.04] text-white'
                : 'border-[#e8e0d5] bg-white text-[#171411]'
            }`}
          >
            {open ? (
              <X size={18} aria-hidden="true" />
            ) : (
              <Menu size={18} aria-hidden="true" />
            )}
          </button>
        </div>
      </header>

      <AnimatePresence>
        {open ? (
          <motion.div
            id="mobile-main-navigation"
            initial={{ opacity: 0, y: -15, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -15, scale: 0.98 }}
            transition={{
              duration: 0.25,
              ease: [0.16, 1, 0.3, 1],
            }}
            className="fixed inset-x-3 top-[84px] z-40 max-h-[calc(100vh-100px)] overflow-y-auto rounded-3xl border border-[#e6dcd0] bg-[#fcfaf7] p-3 shadow-[0_28px_80px_rgba(0,0,0,0.2)] lg:hidden"
          >
            {NAV.map((item, index) => (
              <motion.div
                key={item.href}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  delay: index * 0.04,
                  duration: 0.3,
                }}
              >
                <Link
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className="flex items-center justify-between rounded-2xl px-4 py-3.5 text-sm font-semibold text-[#27201a] hover:bg-[#f3ede6]"
                >
                  {item.label}
                  <ArrowUpRight
                    size={14}
                    aria-hidden="true"
                    className="text-[#978c81]"
                  />
                </Link>
              </motion.div>
            ))}

            <div className="my-2 border-t border-[#ebe2d8]" />

            <div>
              <button
                type="button"
                aria-expanded={toolsOpen}
                aria-controls="mobile-tools-menu"
                onClick={() => setToolsOpen((value) => !value)}
                className="flex w-full items-center justify-between rounded-2xl px-4 py-3.5 text-sm font-semibold text-[#27201a] hover:bg-[#f3ede6]"
              >
                <span className="flex items-center gap-2">
                  <span className="grid h-7 w-7 place-items-center rounded-lg bg-[#f4ebe2] text-[#7a2333]">
                    <QrCode size={14} aria-hidden="true" />
                  </span>
                  Restaurant Tools
                </span>

                <ChevronDown
                  size={17}
                  aria-hidden="true"
                  className={`text-[#978c81] transition-transform duration-200 ${
                    toolsOpen ? 'rotate-180' : ''
                  }`}
                />
              </button>

              <AnimatePresence initial={false}>
                {toolsOpen ? (
                  <motion.div
                    id="mobile-tools-menu"
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{
                      duration: 0.22,
                      ease: [0.16, 1, 0.3, 1],
                    }}
                    className="overflow-hidden"
                  >
                    <div className="px-2 pb-2 pt-1">
                      {TOOLS.map((tool) => {
                        const Icon = tool.icon

                        return (
                          <Link
                            key={tool.href}
                            href={tool.href}
                            onClick={() => setOpen(false)}
                            className="group flex items-start gap-3 rounded-2xl px-3 py-3 transition hover:bg-[#f3ede6]"
                          >
                            <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white text-[#7a2333] shadow-[0_8px_20px_rgba(43,33,24,0.05)]">
                              <Icon size={16} aria-hidden="true" />
                            </span>

                            <span className="min-w-0 flex-1">
                              <span className="block text-[13px] font-semibold text-[#27201a]">
                                {tool.title}
                              </span>
                              <span className="mt-0.5 block text-[11px] leading-4 text-[#8c8177]">
                                {tool.description}
                              </span>
                            </span>

                            <ArrowUpRight
                              size={14}
                              aria-hidden="true"
                              className="mt-1 shrink-0 text-[#a3978d] transition-transform group-hover:translate-x-0.5"
                            />
                          </Link>
                        )
                      })}
                    </div>
                  </motion.div>
                ) : null}
              </AnimatePresence>
            </div>

            <div className="my-2 border-t border-[#ebe2d8]" />

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
