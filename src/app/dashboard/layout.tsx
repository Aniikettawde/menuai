// =====================================================
// FILE: DashboardLayout.tsx
// =====================================================
'use client'

import { useEffect, useMemo, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import Link from 'next/link'
import type { User } from '@supabase/supabase-js'
import {
  BarChart3,
  CreditCard,
  Home,
  LogOut,
  QrCode,
  Store,
  UtensilsCrossed,
} from 'lucide-react'
import { getSupabaseDashboardBrowser } from '@/lib/supabase-dashboard'
import { TrialBanner } from '@/components/billing/TrialBanner'

const NAV = [
  { href: '/dashboard', label: 'Home', icon: Home },
  { href: '/dashboard/restaurant', label: 'Restaurant', icon: Store },
  { href: '/dashboard/menu', label: 'Menu', icon: UtensilsCrossed },
  { href: '/dashboard/analytics', label: 'Analytics', icon: BarChart3 },
  { href: '/dashboard/qr', label: 'QR', icon: QrCode },
  { href: '/dashboard/billing', label: 'Billing', icon: CreditCard },
] as const

const BARE_PAGES = ['/dashboard/login', '/dashboard/onboarding']

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const supabase = getSupabaseDashboardBrowser()

  const [user, setUser] = useState<User | null>(null)
  const [checked, setChecked] = useState(false)

  const isBarePage = BARE_PAGES.includes(pathname)

  const activePage = useMemo(
    () => NAV.find((n) => pathname === n.href || (n.href !== '/dashboard' && pathname.startsWith(n.href))),
    [pathname],
  )

  const isActive = (href: string) => pathname === href || (href !== '/dashboard' && pathname.startsWith(href))

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

  async function handleSignOut() {
    await supabase.auth.signOut()
    setUser(null)
    router.push('/dashboard/login')
  }

  if (isBarePage) return <>{children}</>

  if (!checked) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-[#0a0a0a] text-white">
        <div className="flex flex-col items-center gap-3">
          <div className="relative h-12 w-12">
            <div className="absolute inset-0 rounded-full border-2 border-orange-500/20" />
            <div className="absolute inset-0 animate-spin rounded-full border-2 border-transparent border-t-orange-500" />
            <div className="absolute inset-2 flex items-center justify-center rounded-full bg-orange-500/10">
              <UtensilsCrossed size={14} className="text-orange-400" />
            </div>
          </div>
          <p className="text-xs font-medium tracking-widest text-zinc-600 uppercase">Loading</p>
        </div>
      </div>
    )
  }

  const userInitial = user?.email?.[0]?.toUpperCase() ?? '?'

  return (
    <div className="min-h-dvh overflow-x-hidden bg-[#0a0a0a] text-white">
      <div className="pointer-events-none fixed inset-0 z-0">
        <div className="absolute -top-40 -left-40 h-96 w-96 rounded-full bg-orange-600/8 blur-[120px]" />
        <div className="absolute top-1/2 -right-40 h-80 w-80 rounded-full bg-amber-500/6 blur-[100px]" />
        <div className="absolute -bottom-20 left-1/3 h-64 w-64 rounded-full bg-orange-500/5 blur-[80px]" />
      </div>

      {/* Desktop top header */}
      <header className="hidden lg:flex sticky top-0 z-40 h-16 items-center border-b border-white/[0.06] bg-[#0a0a0a]/90 backdrop-blur-2xl">
        <div className="flex w-full items-center justify-between gap-4 px-6">
          <Link href="/dashboard" className="flex items-center gap-3 shrink-0">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-orange-500 to-amber-500 shadow-lg shadow-orange-500/25">
              <UtensilsCrossed size={16} className="text-white" />
            </div>
            <div>
              <p className="text-sm font-bold tracking-tight text-white">dinerr.in</p>
              <p className="text-[10px] text-zinc-600 font-medium tracking-wider uppercase">Dashboard</p>
            </div>
          </Link>

          <nav className="flex min-w-0 flex-1 items-center justify-center gap-2 xl:gap-3">
            {NAV.map(({ href, label, icon: Icon }) => {
              const active = isActive(href)
              return (
                <Link
                  key={href}
                  href={href}
                  className={`inline-flex items-center gap-2 rounded-full px-3.5 py-2 text-sm font-medium transition whitespace-nowrap ${
                    active
                      ? 'bg-orange-500/15 text-white border border-orange-500/20'
                      : 'border border-transparent text-zinc-500 hover:bg-white/[0.04] hover:text-zinc-200'
                  }`}
                >
                  <Icon size={15} className={active ? 'text-orange-400' : 'text-zinc-500'} />
                  <span>{label}</span>
                </Link>
              )
            })}
          </nav>

          <div className="flex items-center gap-3 shrink-0">
            <div className="flex items-center gap-1.5 rounded-lg border border-white/[0.06] bg-white/[0.04] px-3 py-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-xs font-medium text-zinc-400">Live command center</span>
            </div>
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-orange-500 to-amber-500 text-[11px] font-bold text-white shadow-md shadow-orange-500/20">
              {userInitial}
            </div>
          </div>
        </div>
      </header>

      {/* Mobile top bar */}
      <header className="sticky top-0 z-40 border-b border-white/[0.07] bg-[#0a0a0a]/95 backdrop-blur-2xl lg:hidden">
        <div className="flex h-14 items-center justify-between gap-3 px-4">
          <Link href="/dashboard" className="flex items-center gap-2.5 min-w-0">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-orange-500 to-amber-500">
              <UtensilsCrossed size={13} className="text-white" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-xs font-bold tracking-tight text-white">{activePage?.label ?? 'Dashboard'}</p>
              <p className="truncate text-[10px] leading-none text-zinc-600">dinerr.in</p>
            </div>
          </Link>

          <div className="flex items-center gap-2 shrink-0">
            <div className="flex items-center gap-1.5 rounded-lg border border-emerald-500/20 bg-emerald-500/8 px-2.5 py-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-[10px] font-semibold text-emerald-400 tracking-wide">Live</span>
            </div>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-orange-500 to-amber-500 text-[11px] font-bold text-white shadow-md shadow-orange-500/20">
              {userInitial}
            </div>
          </div>
        </div>
      </header>

      <main className="relative z-10 px-4 pt-4 pb-[92px] sm:px-5 sm:pt-5 lg:px-8 lg:pt-6 lg:pb-10">
        <div className="mx-auto w-full max-w-6xl">
          <TrialBanner />
          {children}
        </div>
      </main>

      {/* Mobile bottom bar */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-white/[0.08] bg-[#0b0b0b]/96 backdrop-blur-2xl lg:hidden">
        <div className="grid grid-cols-6 px-2 py-2 safe-area-pb">
          {NAV.map(({ href, label, icon: Icon }) => {
            const active = isActive(href)
            return (
              <Link
                key={href}
                href={href}
                className={`flex flex-col items-center justify-center gap-1 rounded-xl py-2 text-[10px] font-medium transition ${
                  active ? 'text-orange-400' : 'text-zinc-500'
                }`}
              >
                <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${active ? 'bg-orange-500/12' : 'bg-white/[0.03]'}`}>
                  <Icon size={16} className={active ? 'text-orange-400' : 'text-zinc-500'} />
                </div>
                <span className="leading-none">{label}</span>
              </Link>
            )
          })}
        </div>
      </nav>
    </div>
  )
}


