'use client'

import type { ComponentType } from 'react'
import { useEffect, useMemo, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import Link from 'next/link'
import type { User } from '@supabase/supabase-js'
import {
  BarChart3,
  CreditCard,
  QrCode,
  Store,
  UtensilsCrossed,
  ChevronRight,
  ChevronDown,
  Shield,
  ClipboardList,
  Users,
  Home,
  Tag,
} from 'lucide-react'
import { getSupabaseDashboardBrowser } from '@/lib/supabase-dashboard'
import { TrialBanner } from '@/components/billing/TrialBanner'
import { useDashboardContext } from '@/hooks/useDashboardContext'
import type { TeamRole } from '@/lib/dashboard-access'

const ADMIN_EMAIL = process.env.NEXT_PUBLIC_ADMIN_EMAIL ?? ''

type NavItem = {
  href: string
  label: string
  shortLabel: string
  icon: ComponentType<{ size?: number | string; className?: string }>
}

const ALL_NAV: NavItem[] = [
  { href: '/dashboard/orders', label: 'Orders', shortLabel: 'Orders', icon: ClipboardList },
  { href: '/dashboard/restaurant', label: 'Restaurant', shortLabel: 'Resto', icon: Store },
  { href: '/dashboard/menu', label: 'Menu', shortLabel: 'Menu', icon: UtensilsCrossed },
  { href: '/dashboard/offers', label: 'Offers', shortLabel: 'Offers', icon: Tag },
  { href: '/dashboard/analytics', label: 'Analytics', shortLabel: 'Stats', icon: BarChart3 },
  { href: '/dashboard/qr', label: 'QR Code', shortLabel: 'QR', icon: QrCode },
  { href: '/dashboard/staff', label: 'Staff', shortLabel: 'Staff', icon: Users },
  { href: '/dashboard/billing', label: 'Billing', shortLabel: 'Billing', icon: CreditCard },
]

function getNavForRole(role: TeamRole): NavItem[] {
  if (role === 'waiter') {
    return [ALL_NAV[0]]
  }
  return ALL_NAV
}

const BARE_PAGES = ['/dashboard/login', '/dashboard/onboarding']

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const supabase = getSupabaseDashboardBrowser()
  const { context, loading } = useDashboardContext()

  const [user, setUser] = useState<User | null>(null)
  const [checked, setChecked] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const [showMobileAccountMenu, setShowMobileAccountMenu] = useState(false)
  const [hasSub, setHasSub] = useState<boolean | null>(null)
  const [contextReady, setContextReady] = useState(false)

  const isBarePage = BARE_PAGES.includes(pathname)
  const role = context?.role ?? null
  const navItems = role ? getNavForRole(role) : (hasSub ? ALL_NAV : [])

  const mobileNavItems: NavItem[] = [
    { href: '/dashboard', label: 'Home', shortLabel: 'Home', icon: Home },
    { href: '/dashboard/orders', label: 'Orders', shortLabel: 'Orders', icon: ClipboardList },
    { href: '/dashboard/menu', label: 'Menu', shortLabel: 'Menu', icon: UtensilsCrossed },
    { href: '/dashboard/offers', label: 'Offers', shortLabel: 'Offers', icon: Tag },
    { href: '/dashboard/staff', label: 'Staff', shortLabel: 'Staff', icon: Users },
    { href: '/dashboard/billing', label: 'Billing', shortLabel: 'Billing', icon: CreditCard },
  ]

  const activePage = useMemo(
    () => navItems.find((n) => pathname === n.href || pathname.startsWith(`${n.href}/`)),
    [navItems, pathname],
  )

  const isAdmin = Boolean(user?.email && ADMIN_EMAIL && user.email === ADMIN_EMAIL)

  const isActive = (href: string) =>
    pathname === href || (href !== '/dashboard' && pathname.startsWith(href))

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 10)
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  useEffect(() => {
    if (!context && !loading) {
      fetch('/api/billing/status', { cache: 'no-store' })
        .then((r) => r.json())
        .then((data) => {
          setHasSub(data?.status?.has_access ?? false)
        })
        .catch(() => setHasSub(false))
    }
  }, [context, loading])

  useEffect(() => {
    if (!loading) {
      const t = setTimeout(() => setContextReady(true), 200)
      return () => clearTimeout(t)
    }
  }, [loading])

  useEffect(() => {
    setShowMobileAccountMenu(false)
  }, [pathname])

  useEffect(() => {
    if (isBarePage) {
      setChecked(true)
      return
    }

    let mounted = true

    async function checkSession() {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession()

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

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
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

  async function handleSignOut() {
    try {
      setShowMobileAccountMenu(false)
      await supabase.auth.signOut()
      setUser(null)
      router.push('/dashboard/login')
    } catch (error) {
      console.error('Logout failed:', error)
    }
  }

  function goToDashboard() {
    setShowMobileAccountMenu(false)
    router.push('/dashboard')
  }

  if (isBarePage) return <>{children}</>

  if (!checked || loading || !contextReady) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-[#080808]">
        <div className="flex flex-col items-center gap-4">
          <div className="relative h-14 w-14">
            <div className="absolute inset-0 rounded-2xl border border-orange-500/20" />
            <div
              className="absolute inset-0 animate-spin rounded-2xl border-2 border-transparent border-t-orange-500"
              style={{ animationDuration: '0.8s' }}
            />
            <div className="absolute inset-1.5 flex items-center justify-center rounded-xl bg-gradient-to-br from-orange-500/20 to-amber-500/10">
              <UtensilsCrossed size={16} className="text-orange-400" />
            </div>
          </div>
          <div className="flex flex-col items-center gap-1">
            <p className="text-sm font-semibold text-white">Loading dashboard</p>
            <p className="text-xs text-zinc-600">Just a moment…</p>
          </div>
        </div>
      </div>
    )
  }

  if (!context) {
    if (hasSub === null) {
      return (
        <div className="flex min-h-dvh items-center justify-center bg-[#080808]">
          <div className="flex flex-col items-center gap-4">
            <div className="relative h-14 w-14">
              <div className="absolute inset-0 rounded-2xl border border-orange-500/20" />
              <div
                className="absolute inset-0 animate-spin rounded-2xl border-2 border-transparent border-t-orange-500"
                style={{ animationDuration: '0.8s' }}
              />
              <div className="absolute inset-1.5 flex items-center justify-center rounded-xl bg-gradient-to-br from-orange-500/20 to-amber-500/10">
                <UtensilsCrossed size={16} className="text-orange-400" />
              </div>
            </div>
            <div className="flex flex-col items-center gap-1">
              <p className="text-sm font-semibold text-white">Loading dashboard</p>
              <p className="text-xs text-zinc-600">Just a moment…</p>
            </div>
          </div>
        </div>
      )
    }

    if (!hasSub) {
      return (
        <div className="flex min-h-dvh items-center justify-center bg-[#080808] px-4">
          <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-6">
            <h2 className="text-lg font-semibold text-red-300">No restaurant access</h2>
            <p className="mt-2 text-zinc-400">Your account is not assigned to a restaurant.</p>
          </div>
        </div>
      )
    }
  }

  const userInitial = user?.email?.[0]?.toUpperCase() ?? '?'
  const userEmail = user?.email ?? ''

  return (
    <div className="min-h-dvh overflow-x-hidden bg-[#080808] text-white">
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        <div className="absolute -top-60 -left-60 h-[500px] w-[500px] rounded-full bg-orange-600/6 blur-[140px]" />
        <div className="absolute top-1/3 -right-60 h-[400px] w-[400px] rounded-full bg-amber-500/5 blur-[120px]" />
        <div className="absolute -bottom-40 left-1/4 h-[300px] w-[300px] rounded-full bg-orange-500/4 blur-[100px]" />
      </div>

      <aside className="fixed inset-y-0 left-0 z-50 hidden w-60 flex-col border-r border-white/[0.05] bg-[#0c0c0c]/95 backdrop-blur-2xl xl:flex">
        <div className="flex h-16 items-center gap-3 border-b border-white/[0.05] px-5">
          <button
            type="button"
            onClick={goToDashboard}
            className="flex items-center gap-3 text-left"
            aria-label="Go to dashboard home"
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-orange-500 to-amber-500 shadow-lg shadow-orange-500/20">
              <UtensilsCrossed size={15} className="text-white" />
            </div>
            <div>
              <p className="text-sm font-bold tracking-tight text-white">Dinezy</p>
              <p className="text-[10px] font-medium tracking-widest text-zinc-600 uppercase">Dashboard</p>
            </div>
          </button>
        </div>

        <nav className="flex-1 space-y-0.5 overflow-y-auto p-3 pt-4">
          <p className="mb-3 px-3 text-[10px] font-semibold tracking-widest text-zinc-700 uppercase">
            Navigation
          </p>

          {navItems.map(({ href, label, icon: Icon }) => {
            const active = isActive(href)
            return (
              <Link
                key={href}
                href={href}
                className={`group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-150 ${
                  active
                    ? 'bg-orange-500/12 text-white'
                    : 'text-zinc-500 hover:bg-white/[0.04] hover:text-zinc-200'
                }`}
              >
                <div
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition-all ${
                    active ? 'bg-orange-500/20' : 'bg-white/[0.04] group-hover:bg-white/[0.07]'
                  }`}
                >
                  <Icon size={14} className={active ? 'text-orange-400' : 'text-zinc-500 group-hover:text-zinc-300'} />
                </div>
                <span className="flex-1">{label}</span>
                {active && <ChevronRight size={12} className="text-orange-400/60" />}
              </Link>
            )
          })}

          {isAdmin && (
            <>
              <p className="mb-1 mt-4 px-3 text-[10px] font-semibold tracking-widest text-zinc-700 uppercase">
                Admin
              </p>
              <Link
                href="/admin"
                className={`group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-150 ${
                  pathname.startsWith('/admin')
                    ? 'bg-purple-500/12 text-white'
                    : 'text-zinc-500 hover:bg-white/[0.04] hover:text-zinc-200'
                }`}
              >
                <div
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition-all ${
                    pathname.startsWith('/admin') ? 'bg-purple-500/20' : 'bg-white/[0.04] group-hover:bg-white/[0.07]'
                  }`}
                >
                  <Shield
                    size={14}
                    className={pathname.startsWith('/admin') ? 'text-purple-400' : 'text-zinc-500 group-hover:text-zinc-300'}
                  />
                </div>
                <span className="flex-1">Admin Panel</span>
                {pathname.startsWith('/admin') && <ChevronRight size={12} className="text-purple-400/60" />}
              </Link>
            </>
          )}
        </nav>

        <div className="border-t border-white/[0.05] p-3">
          <div className="flex items-center gap-3 rounded-xl border border-white/[0.05] bg-white/[0.02] p-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-orange-500 to-amber-500 text-[11px] font-bold text-white">
              {userInitial}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold text-white">{userEmail}</p>
              <div className="mt-0.5 flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                <p className="text-[10px] text-zinc-600">{role ?? 'Active'}</p>
              </div>
            </div>
            <button
              onClick={handleSignOut}
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-zinc-600 transition hover:bg-white/[0.06] hover:text-zinc-300"
              title="Sign out"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
            </button>
          </div>
        </div>
      </aside>

      <header
        className={`hidden lg:flex xl:hidden sticky top-0 z-40 h-16 items-center border-b border-white/[0.05] px-6 transition-all duration-300 ${
          scrolled ? 'bg-[#080808]/98 shadow-xl shadow-black/20 backdrop-blur-2xl' : 'bg-[#080808]/90 backdrop-blur-xl'
        }`}
      >
        <div className="flex w-full items-center justify-between gap-4">
          <button
            type="button"
            onClick={goToDashboard}
            className="flex items-center gap-2.5 text-left"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-orange-500 to-amber-500 shadow-md shadow-orange-500/20">
              <UtensilsCrossed size={15} className="text-white" />
            </div>
            <div>
              <p className="text-sm font-bold tracking-tight text-white">{activePage?.label ?? 'Dashboard'}</p>
              <p className="text-[10px] text-zinc-600">Dinezy</p>
            </div>
          </button>
        </div>
      </header>

      <header
        className={`sticky top-0 z-40 border-b border-white/[0.05] transition-all duration-300 lg:hidden ${
          scrolled ? 'bg-[#080808]/98 shadow-lg shadow-black/30 backdrop-blur-2xl' : 'bg-[#080808]/95 backdrop-blur-xl'
        }`}
      >
        <div className="flex h-14 items-center justify-between gap-3 px-4">
          <button
            type="button"
            onClick={goToDashboard}
            className="flex min-w-0 items-center gap-2.5 text-left"
            aria-label="Go to dashboard home"
          >
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-orange-500 to-amber-500 shadow-md shadow-orange-500/20">
              <UtensilsCrossed size={13} className="text-white" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-bold tracking-tight text-white">
                {activePage?.label ?? 'Dashboard'}
              </p>
              <p className="text-[10px] leading-none text-zinc-600">Dinezy</p>
            </div>
          </button>

          <div className="flex items-center gap-2 shrink-0">
            <div className="flex items-center gap-1.5 rounded-lg border border-emerald-500/15 bg-emerald-500/6 px-2.5 py-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-[10px] font-semibold text-emerald-400">Live</span>
            </div>

            <button
              type="button"
              onClick={() => setShowMobileAccountMenu((v) => !v)}
              className="flex items-center gap-1 rounded-xl border border-white/[0.06] bg-white/[0.03] px-1.5 py-1 text-zinc-500 transition hover:bg-white/[0.07] hover:text-zinc-300"
              aria-label="Open account menu"
              aria-expanded={showMobileAccountMenu}
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-orange-500 to-amber-500 text-[11px] font-bold text-white shadow-md shadow-orange-500/20">
                {userInitial}
              </div>
              <ChevronDown
                size={12}
                className={`transition-transform duration-200 ${showMobileAccountMenu ? 'rotate-180' : ''}`}
              />
            </button>
          </div>
        </div>

        {showMobileAccountMenu && (
          <div className="fixed inset-0 z-50 lg:hidden" onClick={() => setShowMobileAccountMenu(false)}>
            <div
              className="absolute right-4 top-16 w-[220px] overflow-hidden rounded-2xl border border-white/[0.08] bg-[#101010] shadow-2xl shadow-black/40"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="border-b border-white/[0.06] px-4 py-3">
                <p className="truncate text-xs font-semibold text-white">{userEmail}</p>
                <p className="mt-0.5 text-[10px] text-zinc-600">{role ?? 'Account'}</p>
              </div>

              <button
                type="button"
                onClick={() => {
                  setShowMobileAccountMenu(false)
                  router.push('/dashboard/change-password')
                }}
                className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm text-zinc-300 transition hover:bg-white/[0.04] hover:text-white"
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/[0.04] text-orange-400">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 17v-1" />
                    <path d="M7 10a5 5 0 0 1 10 0v2H7v-2Z" />
                    <rect x="5" y="10" width="14" height="10" rx="2" />
                  </svg>
                </span>
                <span className="flex-1">Change password</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setShowMobileAccountMenu(false)
                  void handleSignOut()
                }}
                className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm text-zinc-300 transition hover:bg-white/[0.04] hover:text-white"
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/[0.04] text-zinc-400">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                    <polyline points="16 17 21 12 16 7" />
                    <line x1="21" y1="12" x2="9" y2="12" />
                  </svg>
                </span>
                <span className="flex-1">Logout</span>
              </button>
            </div>
          </div>
        )}
      </header>

      <main className="relative z-10 xl:ml-60">
        <div className="px-4 pt-4 pb-[88px] sm:px-5 sm:pt-5 lg:px-6 lg:pt-5 lg:pb-6 xl:px-8 xl:pt-6">
          <div className="mx-auto w-full max-w-5xl">
            <TrialBanner />
            {children}
          </div>
        </div>
      </main>

      <nav className="fixed bottom-0 left-0 right-0 z-50 lg:hidden">
        <div className="border-t border-white/[0.07] bg-[#0c0c0c]/98 backdrop-blur-2xl">
          <div className="grid grid-cols-6 gap-0 px-1 pt-1 pb-safe">
            {mobileNavItems.map(({ href, shortLabel, icon: Icon }) => {
              const active = isActive(href)
              return (
                <Link
                  key={href}
                  href={href}
                  className="flex flex-col items-center justify-center gap-1 py-2 px-1"
                >
                  <div
                    className={`flex h-9 w-9 items-center justify-center rounded-xl transition-all duration-200 ${
                      active
                        ? 'bg-orange-500/15 text-orange-400'
                        : 'text-zinc-500 hover:bg-white/[0.04] hover:text-zinc-200'
                    }`}
                  >
                    <Icon size={14} />
                  </div>
                  <span className={`text-[10px] font-medium ${active ? 'text-orange-400' : 'text-zinc-500'}`}>
                    {shortLabel}
                  </span>
                </Link>
              )
            })}
          </div>
        </div>
      </nav>
    </div>
  )
}