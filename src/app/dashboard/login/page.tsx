'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { getSupabaseDashboardBrowser } from '@/lib/supabase-dashboard'

export default function DashboardLoginPage() {
  const router = useRouter()
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const supabase = getSupabaseDashboardBrowser()

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError('')
    setMessage('')

    try {
      if (mode === 'login') {
        console.log('BUTTON CLICKED')

        const result = await supabase.auth.signInWithPassword({
          email,
          password,
        })

        console.log('FULL RESULT:', result)

        if (result.error) {
          console.log('LOGIN ERROR:', result.error)
          setError(result.error.message)
      } else {
  console.log('LOGIN SUCCESS - starting session wait')

  let attempts = 0
  while (attempts < 10) {
    const { data: { session }, error: sessionError } = await supabase.auth.getSession()
    console.log(`Attempt ${attempts}: session=${!!session}, error=${sessionError?.message}`)
    if (session) {
      console.log('Session confirmed, redirecting...')
      break
    }
    await new Promise(r => setTimeout(r, 150))
    attempts++
  }

  console.log('About to redirect to /dashboard')
  window.location.href = '/dashboard'  // ← back to /dashboard, not /onboarding
}
      } else {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { full_name: name },
          },
        })

        if (error) {
          setError(error.message)
        } else if (data.user && !data.session) {
          setMessage('Check your email to confirm your account, then sign in.')
          setMode('login')
        } else {
          window.location.href = '/dashboard/onboarding'
        }
      }
    } catch (err) {
      console.error('CATCH ERROR:', err)
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 mb-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-orange-400 to-rose-500 flex items-center justify-center">
              <span className="text-white font-bold text-lg">M</span>
            </div>
            <span className="text-white text-2xl font-semibold tracking-tight">MenuAI</span>
          </div>
          <p className="text-zinc-400 text-sm">Restaurant Dashboard</p>
        </div>

        <div className="bg-zinc-900/80 border border-zinc-800 rounded-2xl p-8 backdrop-blur">
          <h1 className="text-white text-xl font-semibold mb-1">
            {mode === 'login' ? 'Welcome back' : 'Create your account'}
          </h1>
          <p className="text-zinc-400 text-sm mb-6">
            {mode === 'login'
              ? 'Sign in to manage your restaurant'
              : 'Start serving smarter menus today'}
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'signup' && (
              <div>
                <label className="block text-zinc-300 text-sm font-medium mb-1.5">
                  Your name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="Rahul Sharma"
                  required
                  className="w-full bg-zinc-800/60 border border-zinc-700 rounded-lg px-4 py-2.5 text-white placeholder-zinc-500 text-sm focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500/30 transition"
                />
              </div>
            )}

            <div>
              <label className="block text-zinc-300 text-sm font-medium mb-1.5">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="owner@restaurant.com"
                required
                className="w-full bg-zinc-800/60 border border-zinc-700 rounded-lg px-4 py-2.5 text-white placeholder-zinc-500 text-sm focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500/30 transition"
              />
            </div>

            <div>
              <label className="block text-zinc-300 text-sm font-medium mb-1.5">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                minLength={6}
                className="w-full bg-zinc-800/60 border border-zinc-700 rounded-lg px-4 py-2.5 text-white placeholder-zinc-500 text-sm focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500/30 transition"
              />
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3 text-red-400 text-sm">
                {error}
              </div>
            )}

            {message && (
              <div className="bg-green-500/10 border border-green-500/30 rounded-lg px-4 py-3 text-green-400 text-sm">
                {message}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-orange-500 to-rose-500 hover:from-orange-400 hover:to-rose-400 text-white font-semibold py-2.5 rounded-lg transition disabled:opacity-60 disabled:cursor-not-allowed mt-2"
            >
              {loading ? 'Please wait…' : mode === 'login' ? 'Sign In' : 'Create Account'}
            </button>
          </form>

          <p className="text-center text-zinc-500 text-sm mt-6">
            {mode === 'login' ? "Don't have an account? " : 'Already have an account? '}
            <button
              type="button"
              onClick={() => {
                setMode(mode === 'login' ? 'signup' : 'login')
                setError('')
                setMessage('')
              }}
              className="text-orange-400 hover:text-orange-300 font-medium transition"
            >
              {mode === 'login' ? 'Sign up' : 'Sign in'}
            </button>
          </p>
        </div>
      </div>
    </div>
  )
}