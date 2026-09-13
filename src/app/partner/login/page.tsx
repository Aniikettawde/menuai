'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabaseBrowser'
export default function PartnerLoginPage() {
  const router = useRouter()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()

    setError('')

    const cleanEmail = email.trim().toLowerCase()

    if (!cleanEmail || !password) {
      setError('Please enter your email and password.')
      return
    }

    setLoading(true)

    try {
      const supabase = createClient()

      const { data, error: loginError } =
        await supabase.auth.signInWithPassword({
          email: cleanEmail,
          password,
        })

      if (loginError) {
        throw new Error(loginError.message)
      }

      if (!data.user) {
        throw new Error('Unable to sign in.')
      }

      // Make sure this account is actually a Dinezy partner
const partnerRes = await fetch('/api/auth/partner/check', {
  method: 'GET',
  cache: 'no-store',
})

const partnerData = await partnerRes.json()

if (!partnerRes.ok) {
  await supabase.auth.signOut()

  throw new Error(
    partnerData.error ||
      'Unable to verify partner account.',
  )
}

      router.replace('/partner/dashboard')
      router.refresh()
    } catch (err) {
      console.error('Partner login error:', err)

      setError(
        err instanceof Error
          ? err.message
          : 'Unable to sign in. Please try again.',
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="text-3xl font-bold tracking-tight">
            Dinezy
          </div>

          <div className="mt-2 text-sm text-slate-400">
            Partner Portal
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-6 shadow-2xl">
          <div className="mb-6">
            <h1 className="text-2xl font-semibold">
              Welcome back
            </h1>

            <p className="mt-1 text-sm text-slate-400">
              Sign in to manage your restaurants and earnings.
            </p>
          </div>

          {error && (
            <div className="mb-5 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
              {error}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label
                htmlFor="email"
                className="mb-2 block text-sm font-medium text-slate-200"
              >
                Email
              </label>

              <input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                disabled={loading}
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none placeholder:text-slate-500 focus:border-white/30 disabled:opacity-60"
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="mb-2 block text-sm font-medium text-slate-200"
              >
                Password
              </label>

              <input
                id="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                disabled={loading}
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none placeholder:text-slate-500 focus:border-white/30 disabled:opacity-60"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-white px-4 py-3 font-semibold text-slate-950 transition hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? 'Signing in...' : 'Sign in'}
            </button>
          </form>

          <div className="mt-6 text-center text-sm text-slate-400">
            Don't have a partner account?{' '}
            <button
              type="button"
              onClick={() => router.push('/partner/signup')}
              className="font-medium text-white hover:underline"
            >
              Become a partner
            </button>
          </div>
        </div>
      </div>
    </main>
  )
}