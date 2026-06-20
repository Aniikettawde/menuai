// src/app/discovery/login/page.tsx
'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowRight, LogIn, Sparkles } from 'lucide-react'
import { getDiscoveryBrowser } from '@/lib/discovery'

export default function DiscoveryLoginPage() {
  const supabase = useMemo(() => getDiscoveryBrowser(), [])
  const router = useRouter()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [checkingSession, setCheckingSession] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    async function checkSession() {
      const { data } = await supabase.auth.getUser()
      if (data.user) { router.replace('/discovery/dashboard'); return }
      setCheckingSession(false)
    }
    void checkSession()
  }, [supabase, router])

  async function handleLogin() {
    setError('')
    if (!email || !password) { setError('Enter your email and password.'); return }
    setLoading(true)
    try {
      const { error: authError } = await supabase.auth.signInWithPassword({ email, password })
      if (authError) throw authError
      router.replace('/discovery/dashboard')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not sign in.')
    } finally {
      setLoading(false)
    }
  }

  if (checkingSession) return <div className="min-h-dvh bg-[#fbfbff]" />

  return (
    <main className="flex min-h-dvh items-center justify-center bg-[radial-gradient(circle_at_top,_rgba(37,99,235,0.14),_transparent_25%),linear-gradient(180deg,#fff_0%,#f8fbff_100%)] px-4 py-10 text-slate-950">
      <div className="w-full max-w-md rounded-[2rem] border border-white/70 bg-white/80 p-8 shadow-[0_25px_80px_rgba(15,23,42,0.08)] backdrop-blur-xl">
        <div className="inline-flex items-center gap-2 rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700">
          <Sparkles size={14} />
          Dinezy Discovery
        </div>
        <h1 className="mt-4 text-3xl font-black tracking-tight">Welcome back</h1>
        <p className="mt-2 text-sm text-slate-600">Log in to manage your restaurant&apos;s discovery listing.</p>

        {error && (
          <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>
        )}

        <div className="mt-6 space-y-4">
          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-slate-700">Email</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="owner@restaurant.com"
              onKeyDown={(e) => e.key === 'Enter' && void handleLogin()}
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none focus:border-indigo-400"
            />
          </label>
          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-slate-700">Password</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Your password"
              onKeyDown={(e) => e.key === 'Enter' && void handleLogin()}
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none focus:border-indigo-400"
            />
          </label>

          <button
            onClick={() => void handleLogin()}
            disabled={loading}
            className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-950 px-5 py-4 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60"
          >
            <LogIn size={16} />
            {loading ? 'Signing in…' : 'Log in'}
          </button>
        </div>

        <p className="mt-6 text-center text-sm text-slate-500">
          Don&apos;t have a listing yet?{' '}
          <Link href="/discovery/onboarding" className="font-semibold text-indigo-600 hover:text-indigo-500">
            Create one <ArrowRight size={12} className="inline" />
          </Link>
        </p>
      </div>
    </main>
  )
}