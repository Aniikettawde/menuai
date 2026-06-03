'use client'

import { useEffect, useState } from 'react'
import { Menu, X, ArrowRight } from 'lucide-react'

const links = [
  { label: 'How it Works', href: '#how' },
  { label: 'Features', href: '#features' },
  { label: 'Impact', href: '#metrics' },
]

export default function LandingNavbar() {
  const [mobileOpen, setMobileOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20)
    }

    window.addEventListener('scroll', handleScroll)

    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  return (
    <>
      <header
        className={`fixed inset-x-0 top-0 z-[100] transition-all duration-300 ${
          scrolled
            ? 'border-b border-white/10 bg-black/80 backdrop-blur-xl'
            : 'bg-transparent'
        }`}
      >
        <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-5 lg:px-8">
          {/* Logo */}
          <a
            href="/"
            className="text-xl font-semibold tracking-tight text-white"
          >
            <span className="text-amber-400">Menu</span>AI
          </a>

          {/* Desktop */}
          <nav className="hidden items-center gap-8 lg:flex">
            {links.map((item) => (
              <a
                key={item.label}
                href={item.href}
                className="text-sm text-white/70 transition hover:text-white"
              >
                {item.label}
              </a>
            ))}
          </nav>

          <div className="hidden lg:block">
            <a
              href="#cta"
              className="inline-flex items-center gap-2 rounded-full bg-amber-500 px-5 py-3 text-sm font-semibold text-black transition hover:bg-amber-400"
            >
              Get a Demo
              <ArrowRight size={16} />
            </a>
          </div>

          {/* Mobile button */}
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-white lg:hidden"
          >
            {mobileOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </header>

      {/* Mobile Drawer */}
      <div
        className={`fixed inset-0 z-[99] lg:hidden transition-all duration-300 ${
          mobileOpen
            ? 'pointer-events-auto opacity-100'
            : 'pointer-events-none opacity-0'
        }`}
      >
        <div
          className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          onClick={() => setMobileOpen(false)}
        />

        <div
          className={`absolute right-0 top-0 h-full w-[85%] max-w-sm border-l border-white/10 bg-[#0a0a0a] transition-transform duration-300 ${
            mobileOpen ? 'translate-x-0' : 'translate-x-full'
          }`}
        >
          <div className="flex h-20 items-center justify-between border-b border-white/10 px-6">
            <div className="text-lg font-semibold text-white">
              <span className="text-amber-400">Menu</span>AI
            </div>

            <button
              onClick={() => setMobileOpen(false)}
              className="rounded-xl border border-white/10 p-2"
            >
              <X size={18} />
            </button>
          </div>

          <div className="p-6">
            <div className="space-y-3">
              {links.map((item) => (
                <a
                  key={item.label}
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  className="block rounded-2xl border border-white/10 bg-white/5 px-4 py-4 text-white/80"
                >
                  {item.label}
                </a>
              ))}
            </div>

            <a
              href="#cta"
              onClick={() => setMobileOpen(false)}
              className="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl bg-amber-500 px-4 py-4 font-semibold text-black"
            >
              Get a Demo
              <ArrowRight size={18} />
            </a>
          </div>
        </div>
      </div>
    </>
  )
}