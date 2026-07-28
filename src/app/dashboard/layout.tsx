'use client'

import type { ComponentType } from 'react'
import { useEffect, useMemo, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import Link from 'next/link'
import type { User } from '@supabase/supabase-js'
import {
  BarChart3,
  CreditCard,
  MessageCircle,
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
import { Sora } from 'next/font/google'

const sora = Sora({ subsets: ['latin'], variable: '--font-sora', weight: ['700', '800'] })

const ADMIN_EMAIL = process.env.NEXT_PUBLIC_ADMIN_EMAIL ?? ''

// ── Brand tokens (mirrors the ivory/burgundy system used on customer-facing pages) ──
// Swap these for your real --pr-* CSS variables once wired up globally.
const BRAND = {
  ivory: '#FBF6EC',
  ivorySoft: '#F3ECDD',
  ivoryDeep: '#F8F3E7',
  card: '#FFFFFF',
  line: '#E7DDC9',
  ink: '#2B211F',
  inkSoft: '#6E5F57',
  inkFaint: '#9C8F86',
  burgundy: '#7A2333',
  burgundyDark: '#5C1A27',
  burgundyLight: '#9B3049',
  plum: '#5B3A5C',
  emerald: '#2F7A5C',
}

type NavItem = {
  href: string
  label: string
  shortLabel: string
  icon: ComponentType<{ size?: number | string; className?: string; style?: React.CSSProperties }>
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

function BrandSpinner({ label, sub }: { label: string; sub: string }) {
  return (
    <div className="flex min-h-dvh items-center justify-center" style={{ background: BRAND.ivory }}>
      <div className="flex flex-col items-center gap-4">
        <div className="relative h-14 w-14">
          <div className="absolute inset-0 rounded-2xl border" style={{ borderColor: `${BRAND.burgundy}26` }} />
          <div
            className="absolute inset-0 animate-spin rounded-2xl border-2 border-transparent"
            style={{ borderTopColor: BRAND.burgundy, animationDuration: '0.8s' }}
          />
          <div
            className="absolute inset-1.5 flex items-center justify-center rounded-xl"
            style={{ background: `linear-gradient(135deg, ${BRAND.burgundy}22, ${BRAND.burgundyLight}14)` }}
          >
            <UtensilsCrossed size={16} style={{ color: BRAND.burgundy }} />
          </div>
        </div>
        <div className="flex flex-col items-center gap-1">
          <p className="text-sm font-semibold" style={{ color: BRAND.ink }}>{label}</p>
          <p className="text-xs" style={{ color: BRAND.inkFaint }}>{sub}</p>
        </div>
      </div>
    </div>
  )
}

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
    return <BrandSpinner label="Loading dashboard" sub="Just a moment…" />
  }

  if (!context) {
    if (hasSub === null) {
      return <BrandSpinner label="Loading dashboard" sub="Just a moment…" />
    }

    if (!hasSub) {
      return (
        <div className="flex min-h-dvh items-center justify-center px-4" style={{ background: BRAND.ivory }}>
          <div className="rounded-2xl border p-6" style={{ borderColor: '#B23B4A33', background: '#B23B4A0F' }}>
            <h2 className="text-lg font-semibold" style={{ color: '#B23B4A' }}>No restaurant access</h2>
            <p className="mt-2" style={{ color: BRAND.inkSoft }}>Your account is not assigned to a restaurant.</p>
          </div>
        </div>
      )
    }
  }

  const userInitial = user?.email?.[0]?.toUpperCase() ?? '?'
  const userEmail = user?.email ?? ''

  return (
    <div className={`${sora.variable} min-h-dvh overflow-x-hidden`} style={{ background: BRAND.ivory, color: BRAND.ink }}>
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        <div className="absolute -top-60 -left-60 h-[500px] w-[500px] rounded-full blur-[140px]" style={{ background: `${BRAND.burgundy}0A` }} />
        <div className="absolute top-1/3 -right-60 h-[400px] w-[400px] rounded-full blur-[120px]" style={{ background: '#C08A2E0A' }} />
        <div className="absolute -bottom-40 left-1/4 h-[300px] w-[300px] rounded-full blur-[100px]" style={{ background: `${BRAND.burgundy}08` }} />
      </div>

      <aside
        className="fixed inset-y-0 left-0 z-50 hidden w-60 flex-col border-r backdrop-blur-2xl xl:flex"
        style={{ borderColor: BRAND.line, background: 'rgba(255,255,255,0.92)' }}
      >
        <div className="flex h-16 items-center gap-3 border-b px-5" style={{ borderColor: BRAND.line }}>
          <button
            type="button"
            onClick={goToDashboard}
            className="flex items-center gap-3 text-left"
            aria-label="Go to dashboard home"
          >
            <div
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl shadow-lg"
              style={{ background: `linear-gradient(135deg, ${BRAND.burgundy}, ${BRAND.burgundyLight})`, boxShadow: `0 8px 20px ${BRAND.burgundy}26` }}
            >
              <UtensilsCrossed size={15} className="text-white" />
            </div>
            <div>
              <p className="text-sm font-bold tracking-tight" style={{ color: BRAND.ink }}>Dinezy</p>
              <p className="text-[10px] font-medium tracking-widest uppercase" style={{ color: BRAND.inkFaint }}>Dashboard</p>
            </div>
          </button>
        </div>

        <nav className="flex-1 space-y-0.5 overflow-y-auto p-3 pt-4">
          <p className="mb-3 px-3 text-[10px] font-semibold tracking-widest uppercase" style={{ color: BRAND.inkFaint }}>
            Navigation
          </p>

          {navItems.map(({ href, label, icon: Icon }) => {
            const active = isActive(href)
            return (
              <Link
                key={href}
                href={href}
                className="group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-150"
                style={{
                  background: active ? `${BRAND.burgundy}12` : 'transparent',
                  color: active ? BRAND.ink : BRAND.inkSoft,
                }}
              >
                {active && (
                  <span
                    className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full"
                    style={{ background: BRAND.burgundy }}
                  />
                )}
                <div
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition-all"
                  style={{ background: active ? `${BRAND.burgundy}1F` : BRAND.ivorySoft }}
                >
                  <Icon size={14} style={{ color: active ? BRAND.burgundy : BRAND.inkFaint }} />
                </div>
                <span className="flex-1">{label}</span>
                {active && <ChevronRight size={12} style={{ color: `${BRAND.burgundy}99` }} />}
              </Link>
            )
          })}

          {isAdmin && (
            <>
              <p className="mb-1 mt-4 px-3 text-[10px] font-semibold tracking-widest uppercase" style={{ color: BRAND.inkFaint }}>
                Admin
              </p>
              <Link
                href="/admin"
                className="group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-150"
                style={{
                  background: pathname.startsWith('/admin') ? `${BRAND.plum}14` : 'transparent',
                  color: pathname.startsWith('/admin') ? BRAND.ink : BRAND.inkSoft,
                }}
              >
                {pathname.startsWith('/admin') && (
                  <span
                    className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full"
                    style={{ background: BRAND.plum }}
                  />
                )}
                <div
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition-all"
                  style={{ background: pathname.startsWith('/admin') ? `${BRAND.plum}22` : BRAND.ivorySoft }}
                >
                  <Shield size={14} style={{ color: pathname.startsWith('/admin') ? BRAND.plum : BRAND.inkFaint }} />
                </div>
                <span className="flex-1">Admin Panel</span>
                {pathname.startsWith('/admin') && <ChevronRight size={12} style={{ color: `${BRAND.plum}99` }} />}
              </Link>
            </>
          )}
        </nav>

        <div className="border-t p-3" style={{ borderColor: BRAND.line }}>
          <div className="flex items-center gap-3 rounded-xl border p-3" style={{ borderColor: BRAND.line, background: BRAND.ivorySoft }}>
            <div
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[11px] font-bold text-white"
              style={{ background: `linear-gradient(135deg, ${BRAND.burgundy}, ${BRAND.burgundyLight})` }}
            >
              {userInitial}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold" style={{ color: BRAND.ink }}>{userEmail}</p>
              <div className="mt-0.5 flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: BRAND.emerald }} />
                <p className="text-[10px]" style={{ color: BRAND.inkFaint }}>{role ?? 'Active'}</p>
              </div>
            </div>
            <button
              onClick={handleSignOut}
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition hover:bg-black/[0.04]"
              style={{ color: BRAND.inkFaint }}
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
        className="hidden lg:flex xl:hidden sticky top-0 z-40 h-16 items-center border-b px-6 transition-all duration-300"
        style={{
          borderColor: BRAND.line,
          background: scrolled ? 'rgba(251,246,236,0.98)' : 'rgba(251,246,236,0.9)',
          backdropFilter: 'blur(24px)',
          boxShadow: scrolled ? '0 10px 30px rgba(43,33,31,0.06)' : 'none',
        }}
      >
        <div className="flex w-full items-center justify-between gap-4">
          <button type="button" onClick={goToDashboard} className="flex items-center gap-2.5 text-left">
            <div
              className="flex h-9 w-9 items-center justify-center rounded-xl shadow-md"
              style={{ background: `linear-gradient(135deg, ${BRAND.burgundy}, ${BRAND.burgundyLight})`, boxShadow: `0 6px 16px ${BRAND.burgundy}26` }}
            >
              <UtensilsCrossed size={15} className="text-white" />
            </div>
            <div>
              <p className="text-sm font-bold tracking-tight" style={{ color: BRAND.ink }}>{activePage?.label ?? 'Dashboard'}</p>
              <p className="text-[10px]" style={{ color: BRAND.inkFaint }}>Dinezy</p>
            </div>
          </button>
        </div>
      </header>

      <header
        className="sticky top-0 z-40 border-b transition-all duration-300 lg:hidden"
        style={{
          borderColor: BRAND.line,
          background: scrolled ? 'rgba(251,246,236,0.98)' : 'rgba(251,246,236,0.95)',
          backdropFilter: 'blur(24px)',
          boxShadow: scrolled ? '0 8px 24px rgba(43,33,31,0.08)' : 'none',
        }}
      >
        <div className="flex h-14 items-center justify-between gap-3 px-4">
          <button
            type="button"
            onClick={goToDashboard}
            className="flex min-w-0 items-center gap-2.5 text-left"
            aria-label="Go to dashboard home"
          >
            <div
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl shadow-md"
              style={{ background: `linear-gradient(135deg, ${BRAND.burgundy}, ${BRAND.burgundyLight})`, boxShadow: `0 6px 16px ${BRAND.burgundy}26` }}
            >
              <UtensilsCrossed size={13} className="text-white" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-bold tracking-tight" style={{ color: BRAND.ink }}>
                {activePage?.label ?? 'Dashboard'}
              </p>
              <p className="text-[10px] leading-none" style={{ color: BRAND.inkFaint }}>Dinezy</p>
            </div>
          </button>

          <div className="flex items-center gap-2 shrink-0">
            <div
              className="flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5"
              style={{ borderColor: `${BRAND.emerald}26`, background: `${BRAND.emerald}0F` }}
            >
              <span className="h-1.5 w-1.5 rounded-full animate-pulse" style={{ background: BRAND.emerald }} />
              <span className="text-[10px] font-semibold" style={{ color: BRAND.emerald }}>Live</span>
            </div>

            <button
              type="button"
              onClick={() => setShowMobileAccountMenu((v) => !v)}
              className="flex items-center gap-1 rounded-xl border px-1.5 py-1 transition hover:bg-black/[0.03]"
              style={{ borderColor: BRAND.line, background: BRAND.card, color: BRAND.inkFaint }}
              aria-label="Open account menu"
              aria-expanded={showMobileAccountMenu}
            >
              <div
                className="flex h-8 w-8 items-center justify-center rounded-lg text-[11px] font-bold text-white shadow-md"
                style={{ background: `linear-gradient(135deg, ${BRAND.burgundy}, ${BRAND.burgundyLight})`, boxShadow: `0 6px 16px ${BRAND.burgundy}26` }}
              >
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
              className="absolute right-4 top-16 w-[220px] overflow-hidden rounded-2xl border shadow-2xl"
              style={{ borderColor: BRAND.line, background: BRAND.card, boxShadow: '0 20px 50px rgba(43,33,31,0.16)' }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="border-b px-4 py-3" style={{ borderColor: BRAND.line }}>
                <p className="truncate text-xs font-semibold" style={{ color: BRAND.ink }}>{userEmail}</p>
                <p className="mt-0.5 text-[10px]" style={{ color: BRAND.inkFaint }}>{role ?? 'Account'}</p>
              </div>

              <button
                type="button"
                onClick={() => {
                  setShowMobileAccountMenu(false)
                  router.push('/dashboard/change-password')
                }}
                className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm transition hover:bg-black/[0.03]"
                style={{ color: BRAND.ink }}
              >
                <span
                  className="flex h-8 w-8 items-center justify-center rounded-lg"
                  style={{ background: BRAND.ivorySoft, color: BRAND.burgundy }}
                >
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
                className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm transition hover:bg-black/[0.03]"
                style={{ color: BRAND.ink }}
              >
                <span
                  className="flex h-8 w-8 items-center justify-center rounded-lg"
                  style={{ background: BRAND.ivorySoft, color: BRAND.inkSoft }}
                >
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
        <div className="border-t backdrop-blur-2xl" style={{ borderColor: BRAND.line, background: 'rgba(255,255,255,0.96)' }}>
          <div className="grid grid-cols-6 gap-0 px-1 pt-1 pb-safe">
            {mobileNavItems.map(({ href, shortLabel, icon: Icon }) => {
              const active = isActive(href)
              return (
                <Link key={href} href={href} className="flex flex-col items-center justify-center gap-1 py-2 px-1">
                  <div
                    className="flex h-9 w-9 items-center justify-center rounded-xl transition-all duration-200"
                    style={{ background: active ? `${BRAND.burgundy}14` : 'transparent', color: active ? BRAND.burgundy : BRAND.inkFaint }}
                  >
                    <Icon size={14} />
                  </div>
                  <span className="text-[10px] font-medium" style={{ color: active ? BRAND.burgundy : BRAND.inkFaint }}>
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