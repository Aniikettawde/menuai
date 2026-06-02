'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import {
  LogOut,
  Home,
  Store,
  UtensilsCrossed,
  BarChart3,
  QrCode,
  CreditCard,
  ChevronRight,
  Menu,
  X,
  Sparkles,
} from 'lucide-react'
import { getSupabaseDashboardBrowser } from '@/lib/supabase-dashboard'
import { TrialBanner } from '@/components/billing/TrialBanner'
import type { User } from '@supabase/supabase-js'

const NAV = [
  { href: '/dashboard', label: 'Overview', icon: Home },
  { href: '/dashboard/restaurant', label: 'Restaurant', icon: Store },
  { href: '/dashboard/menu', label: 'Menu', icon: UtensilsCrossed },
  { href: '/dashboard/analytics', label: 'Analytics', icon: BarChart3 },
  { href: '/dashboard/qr', label: 'QR Code', icon: QrCode },
  { href: '/dashboard/billing', label: 'Billing', icon: CreditCard },
]

const BARE_PAGES = ['/dashboard/login', '/dashboard/onboarding']

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const supabase = getSupabaseDashboardBrowser()

  const [user, setUser] = useState<User | null>(null)
  const [checked, setChecked] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [navFlash, setNavFlash] = useState(false)
  const [prevPath, setPrevPath] = useState(pathname)

  const isBarePage = BARE_PAGES.includes(pathname)

  function isActive(href: string) {
    return pathname === href || (href !== '/dashboard' && pathname.startsWith(href))
  }

  useEffect(() => {
    if (pathname !== prevPath) {
      setPrevPath(pathname)
      setSidebarOpen(false)
      setNavFlash(true)
      const t = setTimeout(() => setNavFlash(false), 450)
      return () => clearTimeout(t)
    }
  }, [pathname, prevPath])

  useEffect(() => {
    if (isBarePage) {
      setChecked(true)
      return
    }

    let mounted = true

    async function checkSession() {
      try {
        const { data: { session } } = await supabase.auth.getSession()

        if (!mounted) return

        if (!session) {
          setChecked(true)
          router.replace('/dashboard/login')
          return
        }

        setUser(session.user)
        setChecked(true)
      } catch {
        if (!mounted) return
        setChecked(true)
        router.replace('/dashboard/login')
      }
    }

    void checkSession()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return

      if (!session) {
        setUser(null)
        setChecked(true)
        router.replace('/dashboard/login')
        return
      }

      setUser(session.user)
      setChecked(true)
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [isBarePage, router, supabase])

  if (isBarePage) return <>{children}</>

  if (!checked) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#09090b] text-white">
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-orange-500 border-t-transparent" />
          <p className="text-sm text-zinc-400">Loading dashboard…</p>
        </div>
      </div>
    )
  }

  async function handleSignOut() {
    await supabase.auth.signOut()
    setUser(null)
    router.push('/dashboard/login')
  }

  const userInitial = user?.email?.[0]?.toUpperCase() ?? '?'
  const activePage = NAV.find((n) => isActive(n.href))

  const SidebarContent = () => (
    <div className="flex h-full flex-col bg-zinc-950/90 backdrop-blur-xl">
      <div className="flex h-20 shrink-0 items-center gap-3 border-b border-white/5 px-5">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-orange-500 to-amber-400 shadow-lg shadow-orange-500/20">
          <UtensilsCrossed size={18} className="text-white" />
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold tracking-tight text-white">dinerr.in</p>
          <p className="truncate text-xs text-zinc-500">Restaurant dashboard</p>
        </div>
        <button
          onClick={() => setSidebarOpen(false)}
          className="ml-auto flex h-8 w-8 items-center justify-center rounded-xl text-zinc-500 transition hover:bg-white/5 hover:text-zinc-200 lg:hidden"
          aria-label="Close menu"
        >
          <X size={16} />
        </button>
      </div>

      <div className="border-b border-white/5 px-4 py-4">
        <div className="rounded-2xl border border-white/5 bg-white/5 p-4">
          <div className="flex items-center gap-2 text-xs font-medium text-orange-300">
            <Sparkles size={14} />
            Quick control center
          </div>
          <p className="mt-2 text-sm text-zinc-300">
            Manage your menu, QR flow, reservations, and analytics from one place.
          </p>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4">
        <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-[0.24em] text-zinc-600">
          Navigation
        </p>

        <div className="space-y-1">
          {NAV.map(({ href, label, icon: Icon }) => {
            const active = isActive(href)

            return (
              <Link
                key={href}
                href={href}
                className={`group relative flex items-center gap-3 rounded-2xl px-3 py-3 text-sm transition-all duration-200 ${
                  active
                    ? 'bg-orange-500/10 text-orange-300 ring-1 ring-orange-500/15'
                    : 'text-zinc-500 hover:bg-white/5 hover:text-zinc-200'
                }`}
              >
                {active && (
                  <span className="absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-orange-500" />
                )}
                <Icon
                  size={17}
                  className={active ? 'text-orange-300' : 'text-zinc-600 transition group-hover:text-zinc-300'}
                />
                <span className="flex-1">{label}</span>
                {active && <ChevronRight size={14} className="text-orange-400/60" />}
              </Link>
            )
          })}
        </div>
      </nav>

      <div className="shrink-0 border-t border-white/5 p-4">
        <div className="rounded-2xl border border-white/5 bg-white/5 p-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-orange-500 to-amber-400 text-xs font-bold text-white">
              {userInitial}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-zinc-200">
                {user?.email ?? 'Restaurant owner'}
              </p>
              <p className="text-xs text-zinc-500">Owner</p>
            </div>
          </div>
        </div>

        <button
          onClick={handleSignOut}
          className="mt-3 flex w-full items-center gap-2 rounded-2xl px-3 py-3 text-sm text-zinc-500 transition hover:bg-white/5 hover:text-red-400"
        >
          <LogOut size={15} />
          Sign out
        </button>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-[#09090b] text-white">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_top,rgba(249,115,22,0.10),transparent_35%),radial-gradient(circle_at_bottom_right,rgba(251,191,36,0.08),transparent_25%)]" />

      <div
        className={`fixed left-0 right-0 top-0 z-[80] h-[2px] origin-left bg-gradient-to-r from-orange-500 via-amber-400 to-orange-300 transition-all duration-500 ${
          navFlash ? 'scale-x-100 opacity-100' : 'scale-x-0 opacity-0'
        }`}
      />

      <aside className="fixed inset-y-0 left-0 z-50 hidden w-80 border-r border-white/5 bg-zinc-950/90 lg:block">
        <SidebarContent />
      </aside>

      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 w-80 border-r border-white/5 bg-zinc-950/95 transition-transform duration-300 lg:hidden ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <SidebarContent />
      </aside>

      <div className="lg:pl-80">
        <TrialBanner />

        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-white/5 bg-[#09090b]/90 px-4 backdrop-blur-xl lg:hidden">
          <button
            onClick={() => setSidebarOpen(true)}
            className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/5 bg-white/5 text-zinc-300 transition hover:bg-white/10"
            aria-label="Open menu"
          >
            <Menu size={18} />
          </button>

          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-orange-500 to-amber-400">
              <UtensilsCrossed size={14} className="text-white" />
            </div>
            <p className="text-sm font-semibold text-white">dinerr.in</p>
          </div>

          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-orange-500/15 text-xs font-bold text-orange-300 ring-1 ring-orange-500/20">
            {userInitial}
          </div>
        </header>

        <header className="sticky top-0 z-30 hidden h-16 items-center justify-between border-b border-white/5 bg-[#09090b]/85 px-6 backdrop-blur-xl lg:flex">
          <div className="flex items-center gap-2 text-sm">
            <span className="text-zinc-500">dinerr.in</span>
            <ChevronRight size={14} className="text-zinc-700" />
            <span className="font-medium text-zinc-200">{activePage?.label ?? 'Dashboard'}</span>
          </div>

          <div className="flex items-center gap-3 rounded-2xl border border-white/5 bg-white/5 px-3 py-2">
            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-orange-500/15 text-[10px] font-bold text-orange-300">
              {userInitial}
            </div>
            <p className="max-w-[220px] truncate text-sm text-zinc-300">
              {user?.email ?? 'Owner'}
            </p>
          </div>
        </header>

        <main className="relative min-h-[calc(100vh-4rem)] px-4 pb-24 pt-4 sm:px-6 sm:pt-6 lg:px-8 lg:pb-10">
          <div className="mx-auto w-full max-w-screen-2xl">{children}</div>
        </main>

        <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-white/5 bg-zinc-950/95 backdrop-blur-xl lg:hidden">
          <div className="grid grid-cols-6 gap-0 px-1 py-1">
            {NAV.map(({ href, label, icon: Icon }) => {
              const active = isActive(href)
              const short =
                {
                  Overview: 'Home',
                  Restaurant: 'Rest',
                  Menu: 'Menu',
                  Analytics: 'Stats',
                  'QR Code': 'QR',
                  Billing: 'Bill',
                }[label] ?? label

              return (
                <Link key={href} href={href} className="flex flex-col items-center gap-1 rounded-2xl py-2">
                  <div
                    className={`flex h-8 w-8 items-center justify-center rounded-xl transition ${
                      active ? 'bg-orange-500/15 text-orange-300' : 'text-zinc-600'
                    }`}
                  >
                    <Icon size={16} />
                  </div>
                  <span className={`text-[10px] font-medium ${active ? 'text-orange-300' : 'text-zinc-600'}`}>
                    {short}
                  </span>
                </Link>
              )
            })}
          </div>
        </nav>
      </div>
    </div>
  )
}