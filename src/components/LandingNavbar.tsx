'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowRight, Menu, PhoneCall, Sparkles, X } from 'lucide-react'

type NavItem = {
  label: string
  href: string
}

type Props = {
  onCallWaiter?: () => void
}

export default function LandingNavbar({ onCallWaiter }: Props) {
  const [mobileOpen, setMobileOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)

  const links = useMemo<NavItem[]>(
    () => [
      { label: 'Features', href: '#features' },
      { label: 'Impact', href: '#metrics' },
      { label: 'Pricing', href: '#pricing' },
      { label: 'About', href: '/about' },
    ],
    [],
  )

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 12)
    handleScroll()

    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? 'hidden' : ''
    return () => {
      document.body.style.overflow = ''
    }
  }, [mobileOpen])

  return (
    <>
      <header
        className={[
          'fixed inset-x-0 top-0 z-[100] transition-all duration-300',
          scrolled
            ? 'border-b border-white/70 bg-white/80 shadow-[0_10px_40px_rgba(15,23,42,0.08)] backdrop-blur-xl'
            : 'bg-transparent',
        ].join(' ')}
      >
        <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-4 sm:px-5 lg:px-8">
          <Link
            href="#top"
            className="group flex items-center gap-3 rounded-2xl transition-transform hover:-translate-y-0.5"
          >
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-violet-600 text-white shadow-lg shadow-blue-500/20">
              D
            </span>
            <span className="min-w-0">
              <span className="block text-[1.02rem] font-semibold tracking-tight text-slate-900">
                Dinezy
              </span>
              <span className="block text-[11px] font-medium text-slate-500">
                Smart restaurant menu
              </span>
            </span>
          </Link>

          <div className="hidden items-center gap-3 lg:flex">
            <div className="rounded-full border border-slate-200 bg-white/80 px-3 py-2 text-xs font-medium text-slate-600 shadow-sm">
              <span className="mr-1 inline-flex h-2 w-2 rounded-full bg-emerald-500 align-middle" />
              Live QR menus
            </div>
            <nav className="flex items-center gap-1 rounded-full border border-slate-200 bg-white/70 p-1 shadow-sm backdrop-blur">
              {links.map((item) => (
                <a
                  key={item.label}
                  href={item.href}
                  className="rounded-full px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-900 hover:text-white"
                >
                  {item.label}
                </a>
              ))}
            </nav>
          </div>

          <div className="hidden items-center gap-3 lg:flex">
            

            <a
              href="#pricing"
              className="inline-flex items-center gap-2 rounded-full bg-gradient-to-br from-blue-600 to-violet-600 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-500/20 transition hover:-translate-y-0.5 hover:shadow-xl"
            >
              Start free trial
              <ArrowRight size={16} />
            </a>
          </div>

          <button
            onClick={() => setMobileOpen(true)}
            className="flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-700 shadow-sm lg:hidden"
            aria-label="Open menu"
          >
            <Menu size={20} />
          </button>
        </div>
      </header>

      <div
        className={[
          'fixed inset-0 z-[110] lg:hidden transition-all duration-300',
          mobileOpen ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0',
        ].join(' ')}
      >
        <button
          type="button"
          className="absolute inset-0 bg-slate-950/35 backdrop-blur-sm"
          onClick={() => setMobileOpen(false)}
          aria-label="Close menu backdrop"
        />

        <aside
          className={[
            'absolute right-0 top-0 h-full w-[88%] max-w-sm',
            'border-l border-slate-200 bg-white shadow-[0_30px_90px_rgba(15,23,42,0.16)]',
            'transition-transform duration-300',
            mobileOpen ? 'translate-x-0' : 'translate-x-full',
          ].join(' ')}
        >
          <div className="flex h-20 items-center justify-between border-b border-slate-200 px-5">
            <Link href="#top" className="flex items-center gap-3" onClick={() => setMobileOpen(false)}>
              <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-violet-600 text-white">
                D
              </span>
              <div>
                <p className="text-sm font-semibold text-slate-900">Dinezy</p>
                <p className="text-[11px] text-slate-500">Smart restaurant menu</p>
              </div>
            </Link>

            <button
              onClick={() => setMobileOpen(false)}
              className="rounded-xl border border-slate-200 p-2 text-slate-700"
              aria-label="Close menu"
            >
              <X size={18} />
            </button>
          </div>

          <div className="flex h-[calc(100%-5rem)] flex-col p-5">
            <div className="space-y-2">
              {links.map((item) => (
                <a
                  key={item.label}
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-slate-700 transition hover:border-blue-200 hover:bg-white hover:text-slate-900"
                >
                  <span className="font-medium">{item.label}</span>
                  <ArrowRight size={16} className="text-slate-400" />
                </a>
              ))}
            </div>

            <div className="mt-5 rounded-[24px] border border-blue-100 bg-gradient-to-br from-blue-50 to-violet-50 p-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                <Sparkles size={14} className="text-blue-600" />
                7-day free trial
              </div>
              <p className="mt-2 text-xs leading-relaxed text-slate-600">
                No card. No UPI. Start quickly and switch to a paid plan after 7 days.
              </p>
            </div>

            <div className="mt-auto grid gap-3 pt-5">
              <button
                type="button"
                onClick={() => {
                  onCallWaiter?.()
                  setMobileOpen(false)
                }}
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-4 font-semibold text-slate-700 shadow-sm"
              >
                <PhoneCall size={16} />
                Call waiter
              </button>

              <a
                href="#pricing"
                onClick={() => setMobileOpen(false)}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-br from-blue-600 to-violet-600 px-4 py-4 font-semibold text-white shadow-lg shadow-blue-500/20"
              >
                Start free trial
                <ArrowRight size={18} />
              </a>
            </div>
          </div>
        </aside>
      </div>
    </>
  )
}